import { execFile, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { app } from "electron";

const OAUTH_BACKUP_PROVIDERS = new Set(["drive", "onedrive", "dropbox"]);
const DEFAULT_AUTH_CALLBACK_PORT = 53682;
const require = createRequire(import.meta.url);
const RCLONE_EXECUTABLE_NAME =
  process.platform === "win32" ? "rclone.exe" : "rclone";

type RcloneInvoker = (
  command: string,
  ...args: Array<string | Record<string, unknown>>
) => ChildProcess;

let cachedRcloneInvoker: RcloneInvoker | null = null;

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
};

const redactRcloneLogText = (value: string): string =>
  value
    .replace(/(token\s*=\s*)(.+)/gi, "$1***")
    .replace(/("access_token"\s*:\s*")(.*?)(")/gi, "$1***$3")
    .replace(/("refresh_token"\s*:\s*")(.*?)(")/gi, "$1***$3");

const resolveBundledRcloneExecutablePath = (): string => {
  const packageJsonPath = require.resolve("rclone.js/package.json");
  const packagedExecutablePath = path.join(
    path.dirname(packageJsonPath),
    "bin",
    RCLONE_EXECUTABLE_NAME,
  );

  if (!app.isPackaged) {
    return packagedExecutablePath;
  }

  return packagedExecutablePath.replace(
    `${path.sep}app.asar${path.sep}`,
    `${path.sep}app.asar.unpacked${path.sep}`,
  );
};

const getRcloneInvoker = (): RcloneInvoker => {
  if (cachedRcloneInvoker) {
    return cachedRcloneInvoker;
  }

  const executablePath = resolveBundledRcloneExecutablePath();

  if (!existsSync(executablePath)) {
    throw new Error(
      `Bundled rclone executable was not found at "${executablePath}". Rebuild the app so Electron unpacks rclone into resources/app.asar.unpacked.`,
    );
  }

  process.env.RCLONE_EXECUTABLE = executablePath;
  cachedRcloneInvoker = require("rclone.js") as RcloneInvoker;

  return cachedRcloneInvoker;
};

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

  const rclone = getRcloneInvoker();
  const subprocess = rclone("authorize", provider, {
    "auto-confirm": true,
  }) as ChildProcess;

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

    subprocess.on("error", (error: Error) => {
      reject(error);
    });

    subprocess.on("close", (code: number | null) => {
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

export const authorizeBackupProviderWithRclone = async (provider: string) => {
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
