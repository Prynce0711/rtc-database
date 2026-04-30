"use client";

import type { ArchiveAdapter } from "@rtc-database/shared";
import {
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
  moveArchiveGarageItems,
  renameArchiveGarageItem,
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
};

export default archiveAdapter;
