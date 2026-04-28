import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDevDisconnectMonitor } from "./BackendMonitor";
import { ensureNativeDatabaseReady } from "./databaseBootstrap";
import "./ipcHandlers";
import { configureRelayCertificatePinning } from "./relayTrust";
import {
  getSavedWindowState,
  saveWindowStateSnapshot,
} from "./Sync/SettingsManager";
import { startUdpListener, stopUdpListener } from "./udpListener";

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

const WINDOW_ICON = path.join(
  process.env.VITE_PUBLIC,
  process.platform === "win32"
    ? "SupremeCourtLogo.ico"
    : "SupremeCourtLogo.png",
);

let win: BrowserWindow | null;

async function createWindow() {
  const savedWindowState = await getSavedWindowState();
  const shouldRestoreFullScreen = savedWindowState?.isFullScreen ?? false;
  const shouldRestoreMaximized =
    !shouldRestoreFullScreen && (savedWindowState?.isMaximized ?? false);

  win = new BrowserWindow({
    width: savedWindowState?.width ?? 1280,
    height: savedWindowState?.height ?? 800,
    ...(savedWindowState?.x !== undefined ? { x: savedWindowState.x } : {}),
    ...(savedWindowState?.y !== undefined ? { y: savedWindowState.y } : {}),
    fullscreen: shouldRestoreFullScreen,
    icon: WINDOW_ICON,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false, // ❌ never true
      contextIsolation: true, // ✅ always true
      sandbox: true, // ✅ isolates renderer
    },

    autoHideMenuBar: true,
  });

  let saveWindowStateTimeout: ReturnType<typeof setTimeout> | null = null;

  const persistWindowState = () => {
    if (!win || win.isDestroyed()) {
      return;
    }

    const bounds = win.getNormalBounds();
    void saveWindowStateSnapshot({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isFullScreen: win.isFullScreen(),
      isMaximized: win.isMaximized(),
    });
  };

  const queueWindowStateSave = () => {
    if (saveWindowStateTimeout) {
      clearTimeout(saveWindowStateTimeout);
    }

    saveWindowStateTimeout = setTimeout(() => {
      persistWindowState();
    }, 250);
  };

  win.on("resize", queueWindowStateSave);
  win.on("move", queueWindowStateSave);
  win.on("enter-full-screen", persistWindowState);
  win.on("leave-full-screen", persistWindowState);
  win.on("maximize", persistWindowState);
  win.on("unmaximize", persistWindowState);
  win.on("close", persistWindowState);

  if (shouldRestoreMaximized) {
    win.maximize();
  }

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    await win.loadURL(VITE_DEV_SERVER_URL);
    startDevDisconnectMonitor(win, VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    await win.loadFile(path.join(RENDERER_DIST, "index.html"));
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
    void createWindow();
  }
});

app.on("before-quit", () => {
  stopUdpListener();
});

app.whenReady().then(async () => {
  try {
    await ensureNativeDatabaseReady();
  } catch (error) {
    console.error("[db] Failed to initialize native database:", error);
  }

  configureRelayCertificatePinning();
  void createWindow();
});
