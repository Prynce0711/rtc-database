import { app, BrowserWindow, dialog, ipcMain } from "electron";

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
