import type ActionResult from "../../ActionResult";
import type { PaginatedResult } from "../../Filter/FilterTypes";
import type { FilterOptions } from "../../Filter/FilterUtils";
import type { RecievingLog } from "../../generated/prisma/browser";
import type { ExportExcelData, UploadExcelResult } from "../../lib/excel";

type RecievingLogFilterData = Pick<
  RecievingLog,
  | "bookAndPage"
  | "dateRecieved"
  | "caseType"
  | "caseNumber"
  | "content"
  | "branchNumber"
  | "notes"
>;

export type RecievingLogFilterOptions = FilterOptions<RecievingLogFilterData>;

export type RecievingLogStats = {
  total: number;
  today: number;
  thisMonth: number;
  docTypes: number;
};

export interface RecievingLogsAdapter {
  getRecievingLogsPage: (
    options?: RecievingLogFilterOptions,
  ) => Promise<ActionResult<PaginatedResult<RecievingLog>>>;
  getRecievingLogsStats: (
    options?: RecievingLogFilterOptions,
  ) => Promise<ActionResult<RecievingLogStats>>;
  createRecievingLog: (
    data: Record<string, unknown>,
  ) => Promise<ActionResult<RecievingLog>>;
  updateRecievingLog: (
    logId: number,
    data: Record<string, unknown>,
  ) => Promise<ActionResult<RecievingLog>>;
  deleteRecievingLog: (logId: number) => Promise<ActionResult<void>>;
  getRecievingLogById: (
    id: string | number,
  ) => Promise<ActionResult<RecievingLog>>;
  getRecievingLogsByIds: (
    ids: (string | number)[],
  ) => Promise<ActionResult<RecievingLog[]>>;
  uploadReceiveExcel: (
    file: File,
    overrideValidation?: boolean,
    overrideDuplicates?: boolean,
    overwriteDuplicates?: boolean,
    allowInFileDuplicates?: boolean,
    validateOnly?: boolean,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportReceiveLogsExcel: () => Promise<ActionResult<ExportExcelData>>;
}
