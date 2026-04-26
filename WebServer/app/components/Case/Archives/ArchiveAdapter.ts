"use client";

import type { ArchiveAdapter } from "@rtc-database/shared";
import {
  createArchiveEntry,
  deleteArchiveEntry,
  getArchiveEntriesByIds,
  getArchiveEntriesPage,
  getArchiveEntryById,
  getArchiveFileUrl,
  getArchiveStats,
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
};

export default archiveAdapter;
