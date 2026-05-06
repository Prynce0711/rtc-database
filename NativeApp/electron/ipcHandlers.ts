import { IPC_CHANNELS } from "@rtc-database/shared";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { exec } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs, watch as fsWatch, type FSWatcher } from "node:fs";
import path from "node:path";
import { authorizeBackupProviderWithRclone } from "./RcloneAuthorizer";
import {
  getPinnedRelayBaseUrl,
  inspectBackendTrust,
  probeRelayReachability,
  savePinnedRelayCertificatePin,
} from "./relayTrust";
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

type ExternalArchiveEditSession = {
  sessionId: string;
  filePath: string;
  lastNotifiedFingerprint: string;
  lastReadFingerprint: string;
  lastDirtyEventAtMs: number;
  lastLocked: boolean;
  openedAtMs: number;
  watcher: FSWatcher;
};

const externalArchiveEditSessions = new Map<
  string,
  ExternalArchiveEditSession
>();
const EXTERNAL_EDIT_NOTIFY_MIN_MS = 15_000;
const EXTERNAL_EDIT_DELETE_DELAY_MS = 15_000;
const DEBUG_EXTERNAL_EDIT = true;
const KEEP_EXTERNAL_EDIT_TEMP = true;
const EXTERNAL_EDIT_MIN_CLOSE_DELAY_MS = 5_000;

const logExternalEdit = (...args: unknown[]) => {
  if (DEBUG_EXTERNAL_EDIT) {
    console.log(...args);
  }
};

const warnExternalEdit = (...args: unknown[]) => {
  if (DEBUG_EXTERNAL_EDIT) {
    console.warn(...args);
  }
};

const safeArchiveTempName = (name: string): string => {
  const fallback = "archive-document";
  const normalized = String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 140);

  return normalized || fallback;
};

const shortSessionHash = (sessionId: string): string => {
  return createHash("md5").update(sessionId).digest("hex").slice(0, 8);
};

const buildReadOnlyTempPath = (filePath: string): string => {
  const parsed = path.parse(filePath);
  const suffix = `-readonly-${Date.now()}`;
  return path.join(parsed.dir, `${parsed.name}${suffix}${parsed.ext}`);
};

const hashBuffer = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");

const hashFile = async (filePath: string): Promise<string> => {
  const data = await fs.readFile(filePath);
  return hashBuffer(data);
};

const archiveFingerprintFromStat = (stat: {
  mtimeMs: number;
  size: number;
}): string => `${Math.floor(stat.mtimeMs)}:${stat.size}`;

const isFileLocked = async (filePath: string): Promise<boolean> => {
  try {
    const handle = await fs.open(filePath, "r+");
    await handle.close();
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      return false;
    }
    if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
      return true;
    }
    return true;
  }
};

const closeExternalArchiveEditSession = async (
  sessionId: string,
  options?: { removeFile?: boolean },
): Promise<void> => {
  const session = externalArchiveEditSessions.get(sessionId);
  if (!session) {
    logExternalEdit("[ARCHIVE_CLOSE] Session not found:", sessionId);
    return;
  }

  if (Date.now() - session.openedAtMs < EXTERNAL_EDIT_MIN_CLOSE_DELAY_MS) {
    warnExternalEdit("[ARCHIVE_CLOSE] Ignored early close:", sessionId);
    return;
  }

  try {
    session.watcher.close();
  } catch (error) {
    console.error("[DEBUG] Failed to close watcher:", error);
  }
  externalArchiveEditSessions.delete(sessionId);

  if (options?.removeFile) {
    if (KEEP_EXTERNAL_EDIT_TEMP) {
      logExternalEdit("[ARCHIVE_CLOSE] Temp file retained:", session.filePath);
      return;
    }

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, EXTERNAL_EDIT_DELETE_DELAY_MS),
      );
      const locked = await isFileLocked(session.filePath);
      if (locked) {
        warnExternalEdit(
          "[ARCHIVE_CLOSE] Skip delete, file is locked:",
          session.filePath,
        );
        return;
      }

      logExternalEdit("[ARCHIVE_CLOSE] Deleting file:", session.filePath);
      await fs.unlink(session.filePath);
      logExternalEdit("[ARCHIVE_CLOSE] File deleted successfully");
    } catch (e) {
      console.error("[ARCHIVE_CLOSE] Failed to delete file:", e);
      // Ignore cleanup errors for already-deleted temp files.
    }
  }
};

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
      if (!isRecord(args) || typeof args.autoConnectPinnedRelay !== "boolean") {
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
        typeof args.relayIssuerName === "string"
          ? args.relayIssuerName
          : undefined,
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

ipcMain.handle(RELAY_NAVIGATE_BACKEND_CHANNEL, async (event, args: unknown) => {
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
});

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
  IPC_CHANNELS.ARCHIVE_OPEN_EXTERNAL_EDIT_SESSION,
  async (
    event,
    args: {
      sessionId: string;
      fileName: string;
      base64: string;
      tempKey?: string;
      serverUpdatedAtMs?: number;
      readOnly?: boolean;
    },
  ) => {
    const sessionId = String(args?.sessionId || "").trim();
    const originalFileName = String(args?.fileName || "").trim();
    const fileName = safeArchiveTempName(originalFileName);
    const base64 = String(args?.base64 || "").trim();
    const tempKey = String(args?.tempKey || "").trim();
    const effectiveTempKey = tempKey || `file:${fileName.toLowerCase()}`;
    const readOnly = args?.readOnly === true;
    const serverUpdatedAtMs =
      typeof args?.serverUpdatedAtMs === "number" &&
      Number.isFinite(args.serverUpdatedAtMs)
        ? args.serverUpdatedAtMs
        : undefined;

    logExternalEdit("[ARCHIVE_OPEN] Received request:", {
      sessionIdLength: sessionId.length,
      fileNameOriginal: originalFileName,
      fileNameSanitized: fileName,
      base64Length: base64.length,
      hasExtension: /\.\w+$/.test(fileName),
      tempKey,
      effectiveTempKey,
      serverUpdatedAtMs,
      readOnly,
    });

    if (!sessionId || !base64 || !fileName) {
      const error = `Missing required fields: sessionId=${!!sessionId}, base64=${!!base64}, fileName=${!!fileName}`;
      console.error("[ARCHIVE_OPEN] Validation failed:", error);
      return {
        success: false,
        error,
      };
    }

    try {
      await closeExternalArchiveEditSession(sessionId);

      const tempRoot = path.join(
        app.getPath("temp"),
        "rtc-archive-edit-sessions",
      );
      const sessionHash = shortSessionHash(effectiveTempKey);
      const sessionDir = path.join(tempRoot, sessionHash);

      logExternalEdit("[ARCHIVE_OPEN] Creating directory:", sessionDir);
      await fs.mkdir(sessionDir, { recursive: true });

      // Verify directory was created
      try {
        await fs.access(sessionDir);
        logExternalEdit("[ARCHIVE_OPEN] Directory verified");
      } catch (dirAccessError) {
        console.error(
          "[ARCHIVE_OPEN] Directory verification failed:",
          dirAccessError,
        );
        throw dirAccessError;
      }

      const filePath = path.join(sessionDir, fileName);
      let targetFilePath = filePath;
      logExternalEdit("[ARCHIVE_OPEN] Target file path:", filePath);

      const bytes = Buffer.from(base64, "base64");
      const incomingHash = hashBuffer(bytes);
      logExternalEdit("[ARCHIVE_OPEN] Decoded bytes:", bytes.length);
      logExternalEdit("[ARCHIVE_OPEN] Incoming hash:", incomingHash);

      if (bytes.length === 0) {
        const error = "File payload is empty (base64 decode failed).";
        console.error("[ARCHIVE_OPEN]", error);
        return {
          success: false,
          error,
        };
      }

      let shouldWrite = true;
      try {
        const existingStat = await fs.stat(filePath);
        if (!readOnly) {
          try {
            await fs.chmod(filePath, 0o666);
          } catch {
            // ignore
          }
        }
        const localMtimeMs = existingStat.mtimeMs;
        const locked = await isFileLocked(filePath);

        if (readOnly) {
          let localHash: string | null = null;
          try {
            localHash = await hashFile(filePath);
          } catch {
            localHash = null;
          }

          if (localHash) {
            logExternalEdit("[ARCHIVE_OPEN] Local hash:", localHash);
          }
          logExternalEdit("[ARCHIVE_OPEN] Local mtime:", localMtimeMs);

          if (locked) {
            targetFilePath = buildReadOnlyTempPath(filePath);
            shouldWrite = true;
            logExternalEdit(
              "[ARCHIVE_OPEN] Read-only temp locked. Using new temp:",
              {
                filePath,
                targetFilePath,
              },
            );
          } else if (localHash && localHash === incomingHash) {
            shouldWrite = false;
            logExternalEdit(
              "[ARCHIVE_OPEN] Local file matches server. Reusing temp.",
            );
          } else {
            shouldWrite = true;
            logExternalEdit(
              "[ARCHIVE_OPEN] Read-only open prefers server copy. Writing latest.",
            );
          }
        } else if (locked) {
          shouldWrite = false;
          warnExternalEdit(
            "[ARCHIVE_OPEN] Skip overwrite, file is locked:",
            filePath,
          );
        } else {
          const localHash = await hashFile(filePath);
          logExternalEdit("[ARCHIVE_OPEN] Local hash:", localHash);
          logExternalEdit("[ARCHIVE_OPEN] Local mtime:", localMtimeMs);

          if (localHash === incomingHash) {
            shouldWrite = false;
            logExternalEdit(
              "[ARCHIVE_OPEN] Local file matches server. Reusing temp.",
            );
          } else if (serverUpdatedAtMs === undefined) {
            shouldWrite = false;
            logExternalEdit(
              "[ARCHIVE_OPEN] Server timestamp missing. Keeping local temp.",
            );
          } else if (localMtimeMs > serverUpdatedAtMs) {
            shouldWrite = false;
            logExternalEdit(
              "[ARCHIVE_OPEN] Local file is newer than server. Keeping local.",
            );
          }
        }
      } catch (statError) {
        logExternalEdit("[ARCHIVE_OPEN] No existing temp file. Writing new.");
      }

      if (shouldWrite) {
        try {
          logExternalEdit("[ARCHIVE_OPEN] Writing file...", targetFilePath);
          await fs.writeFile(targetFilePath, bytes);
          logExternalEdit("[ARCHIVE_OPEN] File written successfully");

          // Add extra delay to ensure file handle is released and OS has flushed to disk
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (writeError) {
          console.error("[ARCHIVE_OPEN] Write failed:", writeError);
          return {
            success: false,
            error: `Failed to write temp file: ${formatError(writeError)}`,
          };
        }
      }

      if (readOnly) {
        try {
          await fs.chmod(targetFilePath, 0o444);
        } catch {
          // ignore
        }
      }

      // Verify file was written and is accessible
      try {
        await fs.access(targetFilePath);
        const stat = await fs.stat(targetFilePath);
        logExternalEdit("[ARCHIVE_OPEN] File verified:", {
          size: stat.size,
          mode: stat.mode,
          path: targetFilePath,
          exists: true,
        });
      } catch (accessError) {
        console.error("[ARCHIVE_OPEN] File verification failed:", accessError);
        // List directory contents for debugging
        try {
          const contents = await fs.readdir(sessionDir);
          logExternalEdit("[ARCHIVE_OPEN] Directory contents:", contents);
        } catch (listError) {
          console.error("[ARCHIVE_OPEN] Failed to list directory:", listError);
        }
        return {
          success: false,
          error: `File write verification failed: ${formatError(accessError)}`,
        };
      }

      if (readOnly) {
        await new Promise((resolve) => setTimeout(resolve, 300));

        logExternalEdit(
          "[ARCHIVE_OPEN] Opening file read-only:",
          targetFilePath,
        );
        const escapedPath = targetFilePath.replace(/"/g, '""');
        exec(`start "" "${escapedPath}"`, (error, stdout, stderr) => {
          if (error) {
            console.error("[ARCHIVE_OPEN] exec error:", error);
          } else {
            logExternalEdit("[ARCHIVE_OPEN] File opened successfully via exec");
          }
          if (stderr) {
            console.error("[ARCHIVE_OPEN] exec stderr:", stderr);
          }
        });

        return {
          success: true,
          result: {
            sessionId,
            filePath: targetFilePath,
          },
        };
      }

      const activeFilePath = targetFilePath;
      const initialStat = await fs.stat(activeFilePath);
      const initialFingerprint = archiveFingerprintFromStat(initialStat);

      const sender = event.sender;
      let pendingWatch = false;
      const handleFileChange = async (eventName: "change" | "rename") => {
        const current = externalArchiveEditSessions.get(sessionId);
        if (!current) {
          return;
        }

        const now = Date.now();
        logExternalEdit("[ARCHIVE_WATCH] Event:", { sessionId, eventName });

        try {
          const fileStat = await fs.stat(activeFilePath);
          const nextFingerprint = archiveFingerprintFromStat(fileStat);

          const locked = await isFileLocked(activeFilePath);
          if (locked !== current.lastLocked) {
            current.lastLocked = locked;
            logExternalEdit("[ARCHIVE_WATCH] File lock state changed:", {
              sessionId,
              locked,
            });
          }

          if (nextFingerprint !== current.lastNotifiedFingerprint) {
            if (
              now - current.lastDirtyEventAtMs >=
              EXTERNAL_EDIT_NOTIFY_MIN_MS
            ) {
              current.lastNotifiedFingerprint = nextFingerprint;
              current.lastDirtyEventAtMs = now;
              logExternalEdit("[ARCHIVE_WATCH] Sending dirty event:", {
                sessionId,
                modifiedAtMs: Math.floor(fileStat.mtimeMs),
                size: fileStat.size,
              });
              sender.send(IPC_CHANNELS.ARCHIVE_EXTERNAL_EDIT_DIRTY_EVENT, {
                sessionId,
                modifiedAtMs: Math.floor(fileStat.mtimeMs),
                size: fileStat.size,
              });
            }
          }
        } catch {
          // Ignore change events when the file is temporarily unavailable.
        }
      };

      const watcher = fsWatch(
        activeFilePath,
        { persistent: true },
        (eventType) => {
          if (eventType !== "change" && eventType !== "rename") {
            return;
          }
          if (pendingWatch) {
            return;
          }
          pendingWatch = true;
          setTimeout(async () => {
            pendingWatch = false;
            await handleFileChange(eventType);
          }, 300);
        },
      );

      logExternalEdit("[ARCHIVE_WATCH] Watcher ready:", {
        sessionId,
        filePath: activeFilePath,
      });
      watcher.on("error", (error) => {
        console.error("[ARCHIVE_WATCH] Watcher error:", error);
      });

      externalArchiveEditSessions.set(sessionId, {
        sessionId,
        filePath: activeFilePath,
        lastNotifiedFingerprint: initialFingerprint,
        lastReadFingerprint: initialFingerprint,
        lastDirtyEventAtMs: 0,
        lastLocked: false,
        openedAtMs: Date.now(),
        watcher,
      });

      // Add a delay to ensure file is fully flushed to disk and handle is released before opening
      await new Promise((resolve) => setTimeout(resolve, 300));

      logExternalEdit(
        "[ARCHIVE_OPEN] Opening file with exec start command:",
        activeFilePath,
      );

      // Use exec with start command instead of shell.openPath to ensure file handle is released
      const escapedPath = activeFilePath.replace(/"/g, '""');
      exec(`start "" "${escapedPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error("[ARCHIVE_OPEN] exec error:", error);
        } else {
          logExternalEdit("[ARCHIVE_OPEN] File opened successfully via exec");
        }
        if (stderr) {
          console.error("[ARCHIVE_OPEN] exec stderr:", stderr);
        }
      });

      logExternalEdit("[ARCHIVE_OPEN] Session ready:", {
        sessionId,
        filePath: activeFilePath,
      });

      return {
        success: true,
        result: {
          sessionId,
          filePath: activeFilePath,
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
  IPC_CHANNELS.ARCHIVE_READ_EXTERNAL_EDIT_SESSION,
  async (
    _event,
    args: {
      sessionId: string;
      force?: boolean;
    },
  ) => {
    const sessionId = String(args?.sessionId || "").trim();
    const force = args?.force === true;
    const session = externalArchiveEditSessions.get(sessionId);
    if (!session) {
      logExternalEdit("[ARCHIVE_READ] Session not found:", { sessionId });
      return {
        success: true,
        result: {
          changed: false,
        },
      };
    }

    try {
      logExternalEdit("[ARCHIVE_READ] Reading session:", { sessionId, force });
      const fileStat = await fs.stat(session.filePath);
      const currentFingerprint = archiveFingerprintFromStat(fileStat);
      const changed =
        force || currentFingerprint !== session.lastReadFingerprint;

      if (!changed) {
        logExternalEdit("[ARCHIVE_READ] No changes detected:", { sessionId });
        return {
          success: true,
          result: {
            changed: false,
          },
        };
      }

      const data = await fs.readFile(session.filePath);
      session.lastReadFingerprint = currentFingerprint;
      session.lastNotifiedFingerprint = currentFingerprint;
      session.lastDirtyEventAtMs = Date.now();

      logExternalEdit("[ARCHIVE_READ] Changes read:", {
        sessionId,
        size: fileStat.size,
        modifiedAtMs: Math.floor(fileStat.mtimeMs),
      });

      return {
        success: true,
        result: {
          changed: true,
          base64: data.toString("base64"),
          size: fileStat.size,
          modifiedAtMs: Math.floor(fileStat.mtimeMs),
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
  IPC_CHANNELS.ARCHIVE_CHECK_EXTERNAL_EDIT_LOCK,
  async (
    _event,
    args: {
      sessionId: string;
    },
  ) => {
    const sessionId = String(args?.sessionId || "").trim();
    const session = externalArchiveEditSessions.get(sessionId);
    if (!session) {
      logExternalEdit("[ARCHIVE_LOCK] Session not found:", { sessionId });
      return {
        success: true,
        result: {
          locked: false,
          exists: false,
        },
      };
    }

    try {
      await fs.access(session.filePath);
      const locked = await isFileLocked(session.filePath);
      logExternalEdit("[ARCHIVE_LOCK] Status:", { sessionId, locked });
      return {
        success: true,
        result: {
          locked,
          exists: true,
        },
      };
    } catch (error) {
      logExternalEdit("[ARCHIVE_LOCK] File missing:", { sessionId });
      return {
        success: true,
        result: {
          locked: false,
          exists: false,
        },
      };
    }
  },
);

ipcMain.handle(
  IPC_CHANNELS.ARCHIVE_CLOSE_EXTERNAL_EDIT_SESSION,
  async (
    _event,
    args: {
      sessionId: string;
      removeFile?: boolean;
    },
  ) => {
    const sessionId = String(args?.sessionId || "").trim();
    if (!sessionId) {
      return {
        success: false,
        error: "Session id is required.",
      };
    }

    try {
      logExternalEdit("[ARCHIVE_CLOSE] Request:", {
        sessionId,
        removeFile: args?.removeFile === true,
      });
      await closeExternalArchiveEditSession(sessionId, {
        removeFile: args?.removeFile === true,
      });
      return {
        success: true,
        result: undefined,
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
  for (const session of externalArchiveEditSessions.values()) {
    session.watcher.close();
  }
  externalArchiveEditSessions.clear();
  void disposeCriminalCasesWorker();
});
