"use client";

import type { ArchiveAdapter } from "@rtc-database/shared";
import {
  getArchiveTransmittalEntriesPage,
  getArchiveTransmittalFileUrl,
  getArchiveTransmittalStats,
} from "./ArchiveTransmittalActions";

type ArchiveTransmittalAdapter = Pick<
  ArchiveAdapter,
  "getArchiveEntriesPage" | "getArchiveStats" | "getArchiveFileUrl"
>;

export const archiveTransmittalAdapter: ArchiveTransmittalAdapter = {
  getArchiveEntriesPage: getArchiveTransmittalEntriesPage,
  getArchiveStats: getArchiveTransmittalStats,
  getArchiveFileUrl: getArchiveTransmittalFileUrl,
};

export default archiveTransmittalAdapter;
