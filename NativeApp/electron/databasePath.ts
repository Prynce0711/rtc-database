import os from "node:os";
import path from "node:path";

const DATABASE_FILE_NAME = "database.db";
const DEFAULT_NATIVE_APP_NAME = "rtc-database-nativeapp";

const readNonEmptyEnv = (name: string): string | null => {
  const value = process.env[name];
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getDefaultUserDataPath = (): string => {
  if (process.platform === "win32") {
    const appData =
      readNonEmptyEnv("APPDATA") ??
      path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, DEFAULT_NATIVE_APP_NAME);
  }

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      DEFAULT_NATIVE_APP_NAME,
    );
  }

  const xdgConfigHome = readNonEmptyEnv("XDG_CONFIG_HOME");
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, DEFAULT_NATIVE_APP_NAME);
  }

  return path.join(os.homedir(), ".config", DEFAULT_NATIVE_APP_NAME);
};

export const getDatabasePath = (): string => {
  const overridePath = readNonEmptyEnv("RTC_DATABASE_PATH");
  if (overridePath) {
    return path.resolve(overridePath);
  }

  const userDataPath =
    readNonEmptyEnv("RTC_NATIVEAPP_USER_DATA_DIR") ?? getDefaultUserDataPath();
  return path.join(userDataPath, DATABASE_FILE_NAME);
};

export const getPrismaDatabaseUrl = (): string => {
  const explicitUrl = readNonEmptyEnv("DATABASE_URL");
  if (explicitUrl) {
    return explicitUrl;
  }

  const normalizedPath = getDatabasePath().replace(/\\/g, "/");
  return `file:${normalizedPath}`;
};
