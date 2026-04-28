import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

const SESSION_USER_SNAPSHOT_FILE = "session-user.json";

export type ElectronSessionUser = {
  id: string;
  name: string;
  role: string;
  status?: string;
  branch?: string;
  darkMode?: boolean;
};

type SessionSnapshotState = {
  user: ElectronSessionUser | null;
};

export const sessionUserSnapshotPath = (): string =>
  path.join(app.getPath("userData"), SESSION_USER_SNAPSHOT_FILE);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sanitizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const sanitizeSessionUser = (
  value: unknown,
): ElectronSessionUser | null => {
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

const readSessionSnapshotState =
  async (): Promise<SessionSnapshotState | null> => {
    try {
      const raw = await fs.readFile(sessionUserSnapshotPath(), "utf8");
      const parsed: unknown = JSON.parse(raw);

      if (!isRecord(parsed)) {
        return null;
      }

      const user =
        parsed.user === null || parsed.user === undefined
          ? null
          : sanitizeSessionUser(parsed.user);

      return {
        user,
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

const writeSessionSnapshotState = async (
  snapshot: SessionSnapshotState,
): Promise<void> => {
  const outputPath = sessionUserSnapshotPath();

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        user: snapshot.user,
      },
      null,
      2,
    ),
    "utf8",
  );
};

export const saveSessionUserSnapshot = async (
  user: ElectronSessionUser | null,
): Promise<void> => {
  if (!user) {
    const outputPath = sessionUserSnapshotPath();

    try {
      await fs.unlink(outputPath);
    } catch (error) {
      if (!(isRecord(error) && error.code === "ENOENT")) {
        throw error;
      }
    }

    return;
  }

  await writeSessionSnapshotState({ user });
};
