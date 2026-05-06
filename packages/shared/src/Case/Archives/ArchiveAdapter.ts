import type ActionResult from "../../ActionResult";
import type { PaginatedResult } from "../../Filter/FilterTypes";
import type {
  ArchiveEntryData,
  ArchiveFilterOptions,
  ArchiveStats,
} from "./ArchiveSchema";

export type ArchiveFileUrlOptions = {
  inline?: boolean;
  fileName?: string;
  contentType?: string;
};

export type ArchiveGarageDirectoryItem = {
  key: string;
  name: string;
  size: number;
  lastModified: Date | string | null;
  isDirectory: boolean;
};

export type ArchiveEditLockOptions = {
  deviceId?: string;
};

export type ArchiveEditLockErrorResult = {
  code: "locked";
  lockId: string;
  lockedBy: string;
  lockDeviceId?: string | null;
};

export interface ArchiveAdapter {
  getArchiveEntriesPage: (
    options?: ArchiveFilterOptions,
  ) => Promise<ActionResult<PaginatedResult<ArchiveEntryData>>>;
  getArchiveStats: (
    options?: ArchiveFilterOptions,
  ) => Promise<ActionResult<ArchiveStats>>;
  createArchiveEntry: (
    data: Record<string, unknown>,
  ) => Promise<ActionResult<ArchiveEntryData>>;
  updateArchiveEntry: (
    id: number,
    data: Record<string, unknown>,
  ) => Promise<ActionResult<ArchiveEntryData>>;
  deleteArchiveEntry: (id: number) => Promise<ActionResult<void>>;
  getArchiveEntryById: (
    id: string | number,
  ) => Promise<ActionResult<ArchiveEntryData>>;
  getArchiveEntriesByIds: (
    ids: Array<string | number>,
  ) => Promise<ActionResult<ArchiveEntryData[]>>;
  getArchiveFileUrl: (
    id: number,
    options?: ArchiveFileUrlOptions,
  ) => Promise<ActionResult<string>>;
  getArchiveGarageDirectoryItems?: (
    folderPath?: string,
  ) => Promise<ActionResult<ArchiveGarageDirectoryItem[]>>;
  getArchiveGarageFileUrl?: (
    key: string,
    options?: ArchiveFileUrlOptions,
  ) => Promise<ActionResult<string>>;
  deleteArchiveGarageItems?: (
    keys: string[],
  ) => Promise<ActionResult<{ deletedCount: number }>>;
  moveArchiveGarageItems?: (
    keys: string[],
    targetFolderPath: string,
  ) => Promise<ActionResult<{ movedCount: number }>>;
  renameArchiveGarageItem?: (
    key: string,
    newName: string,
  ) => Promise<ActionResult<{ movedCount: number }>>;
  acquireArchiveEditLock?: (
    entryId: number,
    options?: ArchiveEditLockOptions,
  ) => Promise<
    ActionResult<
      {
        lockId: string;
        heartbeatIntervalMs: number;
        syncIntervalMs: number;
        expiresInSeconds: number;
      },
      ArchiveEditLockErrorResult
    >
  >;
  heartbeatArchiveEditLock?: (
    lockId: string,
  ) => Promise<ActionResult<{ expiresInSeconds: number }>>;
  releaseArchiveEditLock?: (lockId: string) => Promise<ActionResult<void>>;
  syncArchiveEditedFile?: (
    lockId: string,
    file: File,
  ) => Promise<ActionResult<{ updatedAt: string }>>;
  acquireArchiveGarageEditLock?: (
    garageKey: string,
    options?: ArchiveEditLockOptions,
  ) => Promise<
    ActionResult<
      {
        lockId: string;
        heartbeatIntervalMs: number;
        syncIntervalMs: number;
        expiresInSeconds: number;
      },
      ArchiveEditLockErrorResult
    >
  >;
  heartbeatArchiveGarageEditLock?: (
    lockId: string,
  ) => Promise<ActionResult<{ expiresInSeconds: number }>>;
  releaseArchiveGarageEditLock?: (
    lockId: string,
  ) => Promise<ActionResult<void>>;
  syncArchiveGarageEditedFile?: (
    lockId: string,
    file: File,
  ) => Promise<ActionResult<{ updatedAt: string }>>;
}
