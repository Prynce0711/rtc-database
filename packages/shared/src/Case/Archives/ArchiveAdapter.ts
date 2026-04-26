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
}
