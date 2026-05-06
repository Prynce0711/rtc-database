"use client";

import type { ArchiveAdapter } from "@rtc-database/shared";
import {
  acquireArchiveEditLock,
  acquireArchiveGarageEditLock,
  createArchiveEntry,
  deleteArchiveGarageItems,
  deleteArchiveEntry,
  getArchiveEntriesByIds,
  getArchiveEntriesPage,
  getArchiveEntryById,
  getArchiveFileUrl,
  getArchiveGarageDirectoryItems,
  getArchiveGarageFileUrl,
  getArchiveStats,
  heartbeatArchiveEditLock,
  heartbeatArchiveGarageEditLock,
  moveArchiveGarageItems,
  releaseArchiveEditLock,
  releaseArchiveGarageEditLock,
  renameArchiveGarageItem,
  syncArchiveEditedFile,
  syncArchiveGarageEditedFile,
  updateArchiveEntry,
} from "./ArchiveActions";

export const archiveAdapter: ArchiveAdapter = {
  getArchiveEntriesPage,
  getArchiveStats,
  createArchiveEntry,
  updateArchiveEntry,
  deleteArchiveEntry,
  getArchiveEntryById,
  getArchiveEntriesByIds,
  getArchiveFileUrl,
  getArchiveGarageDirectoryItems,
  getArchiveGarageFileUrl,
  deleteArchiveGarageItems,
  moveArchiveGarageItems,
  renameArchiveGarageItem,
  acquireArchiveEditLock,
  heartbeatArchiveEditLock,
  releaseArchiveEditLock,
  syncArchiveEditedFile,
  acquireArchiveGarageEditLock,
  heartbeatArchiveGarageEditLock,
  releaseArchiveGarageEditLock,
  syncArchiveGarageEditedFile,
};

export default archiveAdapter;
