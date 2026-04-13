import { app, BrowserWindow, dialog, ipcMain } from "electron";

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rclone from "rclone.js";
import { startUdpListener } from "./udpListener";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

const OAUTH_BACKUP_PROVIDERS = new Set(["drive", "onedrive", "dropbox"]);
const DEFAULT_AUTH_CALLBACK_PORT = 53682;
const SESSION_USER_SNAPSHOT_FILE = "session-user.json";

type ElectronSessionUser = {
  id: string;
  name: string;
  role: string;
  status?: string;
  branch?: string;
  darkMode?: boolean;
};

const formatError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sanitizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeSessionUser = (value: unknown): ElectronSessionUser | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = sanitizeOptionalString(value.id);
  const name = sanitizeOptionalString(value.name);

  if (!id || !name) {
    return null;
  }

  const user: ElectronSessionUser = {
    id,
    name,
    role: sanitizeOptionalString(value.role) ?? "user",
  };

  const status = sanitizeOptionalString(value.status);
  if (status) {
    user.status = status;
  }

  const branch = sanitizeOptionalString(value.branch);
  if (branch) {
    user.branch = branch;
  }

  if (typeof value.darkMode === "boolean") {
    user.darkMode = value.darkMode;
  }

  return user;
};

const sessionUserSnapshotPath = (): string =>
  path.join(app.getPath("userData"), SESSION_USER_SNAPSHOT_FILE);

const saveSessionUserSnapshot = async (
  user: ElectronSessionUser | null,
): Promise<void> => {
  const outputPath = sessionUserSnapshotPath();

  if (!user) {
    try {
      await fs.unlink(outputPath);
    } catch (error) {
      if (!(isRecord(error) && error.code === "ENOENT")) {
        throw error;
      }
    }

    return;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        user,
      },
      null,
      2,
    ),
    "utf8",
  );
};

const redactRcloneLogText = (value: string): string =>
  value
    .replace(/(token\s*=\s*)(.+)/gi, "$1***")
    .replace(/("access_token"\s*:\s*")(.*?)(")/gi, "$1***$3")
    .replace(/("refresh_token"\s*:\s*")(.*?)(")/gi, "$1***$3");

const isAuthServerPortConflictError = (message: string): boolean => {
  const lowered = message.toLowerCase();

  return (
    lowered.includes("failed to start auth webserver") &&
    (lowered.includes("address already in use") ||
      lowered.includes("only one usage of each socket address") ||
      lowered.includes("bind:"))
  );
};

const extractAuthCallbackPort = (message: string): number => {
  const match = message.match(/(?:127\.0\.0\.1|localhost):(\d{2,5})/i);
  const parsed = Number(match?.[1] ?? "");

  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  return DEFAULT_AUTH_CALLBACK_PORT;
};

const runExecFile = async (command: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(String(stdout ?? ""));
      },
    );
  });

const forceReleaseAuthCallbackPort = async (port: number): Promise<boolean> => {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    const output = await runExecFile("netstat", ["-ano", "-p", "tcp"]);
    const processIds = new Set<string>();

    for (const line of output.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) {
        continue;
      }

      const protocol = parts[0].toUpperCase();
      const localAddress = parts[1];
      const state = parts[3].toUpperCase();
      const processId = parts[4];

      if (protocol !== "TCP") {
        continue;
      }

      if (state !== "LISTENING") {
        continue;
      }

      if (!localAddress.endsWith(`:${String(port)}`)) {
        continue;
      }

      if (!/^\d+$/.test(processId) || processId === "0") {
        continue;
      }

      processIds.add(processId);
    }

    if (processIds.size === 0) {
      return false;
    }

    for (const processId of processIds) {
      try {
        await runExecFile("taskkill", ["/PID", processId, "/F"]);
      } catch {
        // Ignore individual taskkill failures and continue.
      }
    }

    console.warn(
      `[rclone] Released callback port ${String(port)} by terminating existing authorization process(es).`,
    );

    return true;
  } catch {
    return false;
  }
};

const extractAuthorizeToken = (
  stdoutText: string,
  stderrText: string,
): string | null => {
  const combined = `${stdoutText}\n${stderrText}`;

  const betweenMarkers = combined.match(
    /Paste the following into your remote machine --->\s*([\s\S]*?)\s*<---End paste/i,
  );

  const markerToken = betweenMarkers?.[1]?.trim();
  if (markerToken) {
    return markerToken;
  }

  const jsonToken = combined.match(/(\{[\s\S]*?"access_token"[\s\S]*?\})/i);
  const parsedJsonToken = jsonToken?.[1]?.trim();

  return parsedJsonToken || null;
};

const runRcloneAuthorizeForToken = async (
  provider: string,
): Promise<string> => {
  console.log(`[rclone:${provider}] running authorize`);

  const subprocess = rclone("authorize", provider, {
    "auto-confirm": true,
  });

  let stdoutText = "";
  let stderrText = "";

  return new Promise<string>((resolve, reject) => {
    subprocess.stdout?.on("data", (chunk) => {
      const chunkText = Buffer.from(chunk).toString("utf8");
      stdoutText += chunkText;

      const logText = redactRcloneLogText(chunkText).trimEnd();
      if (logText) {
        console.log(`[rclone:${provider}:stdout] ${logText}`);
      }
    });

    subprocess.stderr?.on("data", (chunk) => {
      const chunkText = Buffer.from(chunk).toString("utf8");
      stderrText += chunkText;

      const logText = redactRcloneLogText(chunkText).trimEnd();
      if (logText) {
        console.error(`[rclone:${provider}:stderr] ${logText}`);
      }
    });

    subprocess.on("error", (error) => {
      reject(error);
    });

    subprocess.on("close", (code) => {
      if ((code ?? 0) === 0) {
        const token = extractAuthorizeToken(stdoutText, stderrText);

        if (!token) {
          reject(
            new Error(
              "Authorization did not return a token. Complete the browser flow and try again.",
            ),
          );
          return;
        }

        console.log(`[rclone:${provider}] authorize completed successfully`);
        resolve(token);
        return;
      }

      const combined = `${stderrText}\n${stdoutText}`.trim();
      reject(
        new Error(
          combined ||
            `rclone authorize failed with exit code ${String(code ?? 0)}`,
        ),
      );
    });
  });
};

const authorizeBackupProviderWithRclone = async (provider: string) => {
  const normalizedProvider = provider.trim().toLowerCase();
  if (!OAUTH_BACKUP_PROVIDERS.has(normalizedProvider)) {
    throw new Error("Provider is not supported for OAuth authorization.");
  }

  const runAuthorize = async () =>
    runRcloneAuthorizeForToken(normalizedProvider);

  let token: string;

  try {
    token = await runAuthorize();
  } catch (error) {
    const message = formatError(error);

    if (!isAuthServerPortConflictError(message)) {
      throw error instanceof Error ? error : new Error(message);
    }

    const callbackPort = extractAuthCallbackPort(message);
    const released = await forceReleaseAuthCallbackPort(callbackPort);

    if (!released) {
      throw new Error(
        `Another account authorization is already using the local callback port (http://localhost:${String(callbackPort)}/). Close previous browser sign-in flow and try again.`,
      );
    }

    console.warn(
      `[rclone:${normalizedProvider}] Retrying authorize after releasing callback port ${String(callbackPort)}.`,
    );

    try {
      token = await runAuthorize();
    } catch (retryError) {
      const retryMessage = formatError(retryError);

      if (isAuthServerPortConflictError(retryMessage)) {
        throw new Error(
          `Could not take over the local callback port (${String(callbackPort)}). Close any previous browser sign-in flow and try again.`,
        );
      }

      throw retryError instanceof Error ? retryError : new Error(retryMessage);
    }
  }

  return {
    provider: normalizedProvider,
    options: {
      token,
    },
  };
};

const resolveSafePath = (baseFolder: string, relativePath: string) => {
  const normalizedBase = path.resolve(baseFolder);
  const safeRelative = relativePath.replace(/^[\\/]+/, "");
  const fullPath = path.resolve(normalizedBase, safeRelative);

  if (
    fullPath !== normalizedBase &&
    !fullPath.startsWith(`${normalizedBase}${path.sep}`)
  ) {
    return null;
  }

  return fullPath;
};

ipcMain.handle("files:select-base-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle(
  "files:check-exists",
  async (_event, args: { baseFolder: string; relativePaths: string[] }) => {
    const results: Record<string, boolean> = {};
    const baseFolder = args.baseFolder;

    await Promise.all(
      args.relativePaths.map(async (relativePath) => {
        const fullPath = resolveSafePath(baseFolder, relativePath);
        if (!fullPath) {
          results[relativePath] = false;
          return;
        }
        try {
          await fs.access(fullPath);
          results[relativePath] = true;
        } catch {
          results[relativePath] = false;
        }
      }),
    );

    return results;
  },
);

ipcMain.handle(
  "files:read",
  async (_event, args: { baseFolder: string; relativePath: string }) => {
    const fullPath = resolveSafePath(args.baseFolder, args.relativePath);
    if (!fullPath) {
      return { success: false, error: "Invalid path." };
    }

    try {
      const data = await fs.readFile(fullPath);
      return {
        success: true,
        result: {
          base64: data.toString("base64"),
          name: path.basename(fullPath),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to read file",
      };
    }
  },
);

ipcMain.handle(
  "rclone:authorize-provider",
  async (_event, args: { provider: string }) => {
    try {
      if (!args || typeof args.provider !== "string") {
        return {
          success: false,
          error: "Provider is required.",
        };
      }

      const result = await authorizeBackupProviderWithRclone(args.provider);

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: formatError(error),
      };
    }
  },
);

ipcMain.handle("session:sync-user-minimal", async (_event, args: unknown) => {
  try {
    if (!isRecord(args) || !("user" in args)) {
      return {
        success: false,
        error: "User payload is required.",
      };
    }

    const rawUser = args.user;
    const user = rawUser === null ? null : sanitizeSessionUser(rawUser);

    if (rawUser !== null && !user) {
      return {
        success: false,
        error: "Invalid user payload.",
      };
    }

    await saveSessionUserSnapshot(user);

    return {
      success: true,
      result: {
        path: sessionUserSnapshotPath(),
        hasUser: Boolean(user),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
});

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false, // ❌ never true
      contextIsolation: true, // ✅ always true
      sandbox: true, // ✅ isolates renderer
    },

    autoHideMenuBar: true,
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  startUdpListener(win);
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);
