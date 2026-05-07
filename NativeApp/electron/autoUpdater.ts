import { app, dialog } from "electron";
import { autoUpdater } from "electron-updater";

const UPDATE_CHECK_DELAY_MS = 10_000;
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

const logUpdate = (...args: unknown[]): void => {
  console.log("[update]", ...args);
};

const warnUpdate = (...args: unknown[]): void => {
  console.warn("[update]", ...args);
};

export const configureAutoUpdates = (): void => {
  if (!app.isPackaged) {
    logUpdate("Skipping auto updates outside packaged app.");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    logUpdate("Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    logUpdate(`Update available: ${info.version}`);
  });

  autoUpdater.on("update-not-available", (info) => {
    logUpdate(`No update available. Current version: ${info.version}`);
  });

  autoUpdater.on("download-progress", (progress) => {
    logUpdate(
      `Downloading update: ${progress.percent.toFixed(1)}% (${progress.transferred}/${progress.total})`,
    );
  });

  autoUpdater.on("error", (error) => {
    warnUpdate("Auto update failed:", error);
  });

  autoUpdater.on("update-downloaded", (info) => {
    logUpdate(`Update downloaded: ${info.version}`);

    void dialog
      .showMessageBox({
        type: "info",
        title: "Update ready",
        message: "A new version has been downloaded.",
        detail: "Restart the app to finish installing the update.",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, UPDATE_CHECK_DELAY_MS);

  updateCheckInterval = setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, UPDATE_CHECK_INTERVAL_MS);

  app.once("before-quit", () => {
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
      updateCheckInterval = null;
    }
  });
};
