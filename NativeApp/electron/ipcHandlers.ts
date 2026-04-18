import { IPC_CHANNELS } from "@rtc-database/shared";
import { dialog, ipcMain } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { authorizeBackupProviderWithRclone } from "./RcloneAuthorizer";
import { upsertSingleCriminalCase } from "./Sync/Case/CriminalCaseActions";
import {
  isRecord,
  sanitizeSessionUser,
  saveSessionUserSnapshot,
  sessionUserSnapshotPath,
} from "./Sync/session";
import { formatError, resolveSafePath } from "./utils";

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
  IPC_CHANNELS.UPSERT_SINGLE_CRIMINAL_CASE,
  async (_event, payload: unknown) => {
    console.log("[sync:criminal] IPC request received from renderer.", {
      channel: IPC_CHANNELS.UPSERT_SINGLE_CRIMINAL_CASE,
    });

    const response = await upsertSingleCriminalCase(payload);

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
