import { deviceID } from "@rtc-database/shared";
import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { isRecord } from "./SessionManager";

const SETTINGS_SNAPSHOT_FILE = "settings.json";

export type ElectronWindowState = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isFullScreen?: boolean;
  isMaximized?: boolean;
};

type SettingsSnapshotState = {
  deviceId?: string;
  windowState?: ElectronWindowState;
};

export const settingsSnapshotPath = (): string =>
  path.join(app.getPath("userData"), SETTINGS_SNAPSHOT_FILE);

const sanitizeFiniteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const sanitizeWindowState = (
  value: unknown,
): ElectronWindowState | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const width = sanitizeFiniteNumber(value.width);
  const height = sanitizeFiniteNumber(value.height);

  if (!width || !height) {
    return undefined;
  }

  const windowState: ElectronWindowState = { width, height };

  const x = sanitizeFiniteNumber(value.x);
  if (x !== undefined) {
    windowState.x = x;
  }

  const y = sanitizeFiniteNumber(value.y);
  if (y !== undefined) {
    windowState.y = y;
  }

  if (typeof value.isFullScreen === "boolean") {
    windowState.isFullScreen = value.isFullScreen;
  }

  if (typeof value.isMaximized === "boolean") {
    windowState.isMaximized = value.isMaximized;
  }

  return windowState;
};

const readSettingsSnapshotState = async (): Promise<
  SettingsSnapshotState | null
> => {
  try {
    const raw = await fs.readFile(settingsSnapshotPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return null;
    }

    const parsedDeviceId = deviceID.safeParse(parsed.deviceId);
    const deviceId = parsedDeviceId.success ? parsedDeviceId.data : undefined;
    const windowState = sanitizeWindowState(parsed.windowState);

    return {
      deviceId,
      windowState,
    };
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return null;
    }

    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
};

const writeSettingsSnapshotState = async (
  snapshot: SettingsSnapshotState,
): Promise<void> => {
  const outputPath = settingsSnapshotPath();

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        ...(snapshot.deviceId ? { deviceId: snapshot.deviceId } : {}),
        ...(snapshot.windowState ? { windowState: snapshot.windowState } : {}),
      },
      null,
      2,
    ),
    "utf8",
  );
};

const getSettingsSnapshotState = async (): Promise<SettingsSnapshotState> => {
  const settingsSnapshot = await readSettingsSnapshotState();
  if (settingsSnapshot) {
    return settingsSnapshot;
  }

  return {};
};

export const getSavedWindowState = async (): Promise<
  ElectronWindowState | undefined
> => {
  const existingSnapshot = await getSettingsSnapshotState();
  return existingSnapshot.windowState;
};

export const saveWindowStateSnapshot = async (
  windowState: ElectronWindowState,
): Promise<void> => {
  const existingSnapshot = await getSettingsSnapshotState();

  await writeSettingsSnapshotState({
    deviceId: existingSnapshot.deviceId,
    windowState,
  });
};

export const getOrCreateDeviceId = async (): Promise<string> => {
  const existingSnapshot = await getSettingsSnapshotState();
  if (existingSnapshot.deviceId) {
    return existingSnapshot.deviceId;
  }

  const deviceId = uuidv4();

  await writeSettingsSnapshotState({
    deviceId,
    windowState: existingSnapshot.windowState,
  });

  return deviceId;
};
