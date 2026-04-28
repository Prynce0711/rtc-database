import { IPC_CHANNELS } from "@rtc-database/shared";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { authorizeBackupProviderWithRclone } from "./RcloneAuthorizer";
import { doesCaseExist, getCases, getCaseStats } from "./Sync/BaseCaseActions";
import {
  getCriminalCaseById,
  getCriminalCaseNumberPreview,
  getCriminalCases,
  getCriminalCasesByCaseNumbers,
  getCriminalCasesByIds,
  getCriminalCaseStats,
} from "./Sync/Case/CriminalCasesActions";
import {
  disposeCriminalCasesWorker,
  upsertCriminalCasesInWorker,
} from "./Sync/Case/CriminalCasesWorkerManager";
import {
  isRecord,
  sanitizeSessionUser,
  saveSessionUserSnapshot,
  sessionUserSnapshotPath,
} from "./Sync/SessionManager";
import {
  getPinnedRelayBaseUrl,
  inspectBackendTrust,
  probeRelayReachability,
  savePinnedRelayCertificatePin,
} from "./relayTrust";
import {
  getAutoConnectPinnedRelayEnabled,
  getOrCreateDeviceId,
  saveAutoConnectPinnedRelayEnabled,
} from "./Sync/SettingsManager";
import { formatError, resolveSafePath } from "./utils";

const RELAY_INSPECT_BACKEND_CHANNEL = "relay:inspect-backend";
const RELAY_TRUST_BACKEND_CHANNEL = "relay:trust-backend";
const RELAY_NAVIGATE_BACKEND_CHANNEL = "relay:navigate-backend";
const RELAY_GET_STARTUP_SETTINGS_CHANNEL = "relay:get-startup-settings";
const RELAY_SET_STARTUP_SETTINGS_CHANNEL = "relay:set-startup-settings";

const bringWindowToFront = (window: BrowserWindow | null): void => {
  if (!window || window.isDestroyed()) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  if (!window.isVisible()) {
    window.show();
  }

  // Toggle top-most briefly so focus changes are respected on Windows.
  window.setAlwaysOnTop(true);
  window.focus();
  window.setAlwaysOnTop(false);
};

ipcMain.handle(IPC_CHANNELS.CASE_DOES_EXIST, async (_event, args) => {
  return doesCaseExist(args.caseNumbers, args.caseType);
});

ipcMain.handle(RELAY_INSPECT_BACKEND_CHANNEL, async (_event, args: unknown) => {
  try {
    if (!isRecord(args) || typeof args.url !== "string" || !args.url.trim()) {
      return {
        success: false,
        error: "Server URL is required.",
      };
    }

    if (
      args.requireReachable === true &&
      !(await probeRelayReachability(args.url))
    ) {
      return {
        success: false,
        error:
          "No server was found at that address and port. Check the address and port, then try again.",
      };
    }

    return {
      success: true,
      result: await inspectBackendTrust(args.url),
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
});

ipcMain.handle(RELAY_GET_STARTUP_SETTINGS_CHANNEL, async () => {
  try {
    return {
      success: true,
      result: {
        autoConnectPinnedRelay: await getAutoConnectPinnedRelayEnabled(),
        pinnedRelayUrl: getPinnedRelayBaseUrl(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
});

ipcMain.handle(
  RELAY_SET_STARTUP_SETTINGS_CHANNEL,
  async (_event, args: unknown) => {
    try {
      if (
        !isRecord(args) ||
        typeof args.autoConnectPinnedRelay !== "boolean"
      ) {
        return {
          success: false,
          error: "Startup preference is required.",
        };
      }

      await saveAutoConnectPinnedRelayEnabled(args.autoConnectPinnedRelay);

      return {
        success: true,
        result: {
          autoConnectPinnedRelay: args.autoConnectPinnedRelay,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: formatError(error),
      };
    }
  },
);

ipcMain.handle(RELAY_TRUST_BACKEND_CHANNEL, async (_event, args: unknown) => {
  try {
    if (!isRecord(args)) {
      return {
        success: false,
        error: "Server approval details are required.",
      };
    }

    if (
      typeof args.url !== "string" ||
      !args.url.trim() ||
      typeof args.relayFingerprint256 !== "string" ||
      !args.relayFingerprint256.trim()
    ) {
      return {
        success: false,
        error: "The server identity details are incomplete.",
      };
    }

    const parsedUrl = new URL(args.url);
    const port =
      Number(parsedUrl.port) || (parsedUrl.protocol === "https:" ? 443 : 80);

    const pinnedRelay = savePinnedRelayCertificatePin({
      fingerprint256: args.relayFingerprint256,
      protocol:
        parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
          ? (parsedUrl.protocol.slice(0, -1) as "http" | "https")
          : "https",
      hostname: parsedUrl.hostname,
      port,
      establishedAt: new Date().toISOString(),
      subjectName:
        typeof args.relaySubjectName === "string"
          ? args.relaySubjectName
          : undefined,
      issuerName:
        typeof args.relayIssuerName === "string" ? args.relayIssuerName : undefined,
    });

    return {
      success: true,
      result: {
        fingerprint256: pinnedRelay.fingerprint256,
        hostname: pinnedRelay.hostname ?? parsedUrl.hostname,
        port: pinnedRelay.port ?? port,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
});

ipcMain.handle(
  RELAY_NAVIGATE_BACKEND_CHANNEL,
  async (event, args: unknown) => {
    let previousUrl = "";

    try {
      if (!isRecord(args) || typeof args.url !== "string" || !args.url.trim()) {
        return {
          success: false,
          error: "Server URL is required.",
        };
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow || browserWindow.isDestroyed()) {
        return {
          success: false,
          error: "The app window is no longer available.",
        };
      }

      previousUrl = browserWindow.webContents.getURL();
      await browserWindow.loadURL(args.url);

      return {
        success: true,
      };
    } catch (error) {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (
        browserWindow &&
        !browserWindow.isDestroyed() &&
        previousUrl &&
        previousUrl !== browserWindow.webContents.getURL() &&
        !previousUrl.startsWith("chrome-error://")
      ) {
        try {
          await browserWindow.loadURL(previousUrl);
        } catch (restoreError) {
          console.warn(
            "[relay-nav] Failed to restore previous page after navigation error:",
            formatError(restoreError),
          );
        }
      }

      return {
        success: false,
        error: formatError(error),
      };
    }
  },
);

ipcMain.handle(IPC_CHANNELS.CASE_GETS, async (_event, options) => {
  return getCases(options);
});

ipcMain.handle(IPC_CHANNELS.CASE_STATS, async (_event, options) => {
  return getCaseStats(options);
});

ipcMain.handle(IPC_CHANNELS.CRIMINAL_CASES_GET, async (_event, options) => {
  return getCriminalCases(options);
});

ipcMain.handle(IPC_CHANNELS.CRIMINAL_CASES_STATS, async (_event, options) => {
  return getCriminalCaseStats(options);
});

ipcMain.handle(
  IPC_CHANNELS.CRIMINAL_CASE_NUMBER_PREVIEW,
  async (_event, args) => {
    return getCriminalCaseNumberPreview(args.area, args.year);
  },
);

ipcMain.handle(IPC_CHANNELS.CRIMINAL_CASE_GET_BY_ID, async (_event, id) => {
  return getCriminalCaseById(id);
});

ipcMain.handle(IPC_CHANNELS.CRIMINAL_CASE_GET_BY_IDS, async (_event, ids) => {
  return getCriminalCasesByIds(ids);
});

ipcMain.handle(
  IPC_CHANNELS.CRIMINAL_CASE_GET_BY_CASE_NUMBERS,
  async (_event, caseNumbers) => {
    return getCriminalCasesByCaseNumbers(caseNumbers);
  },
);

ipcMain.handle(IPC_CHANNELS.FILES_SELECT_BASE_FOLDER, async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle(
  IPC_CHANNELS.FILES_CHECK_EXISTS,
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
  IPC_CHANNELS.FILES_READ,
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
  IPC_CHANNELS.RCLONE_AUTHORIZE_PROVIDER,
  async (event, args: { provider: string }) => {
    try {
      if (!args || typeof args.provider !== "string") {
        return {
          success: false,
          error: "Provider is required.",
        };
      }

      const result = await authorizeBackupProviderWithRclone(args.provider);

      const requestingWindow = BrowserWindow.fromWebContents(event.sender);
      const fallbackWindow = BrowserWindow.getAllWindows()[0] ?? null;
      bringWindowToFront(requestingWindow ?? fallbackWindow);

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

ipcMain.handle(IPC_CHANNELS.SESSION_GET_DEVICE_ID, async () => {
  try {
    const deviceId = await getOrCreateDeviceId();

    return {
      success: true,
      result: { deviceId },
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
});

ipcMain.handle(
  IPC_CHANNELS.SESSION_SYNC_USER_MINIMAL,
  async (_event, args: unknown) => {
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
  },
);

ipcMain.handle(
  IPC_CHANNELS.UPSERT_CRIMINAL_CASES,
  async (_event, payload: unknown) => {
    console.log("[sync:criminal] IPC request received from renderer.", {
      channel: IPC_CHANNELS.UPSERT_CRIMINAL_CASES,
    });

    const response = await upsertCriminalCasesInWorker(payload);

    if (!response.success) {
      console.warn("[sync:criminal] IPC request failed.", response.error);
      return response;
    }

    console.log(
      "[sync:criminal] IPC request completed successfully.",
      response.result,
    );

    return response;
  },
);

app.on("before-quit", () => {
  void disposeCriminalCasesWorker();
});
