import type ActionResult from "../../ActionResult";
import type { PaginatedResult } from "../../Filter/FilterTypes";
import type { Case } from "../../generated/prisma/browser";
import type { ExportExcelData, UploadExcelResult } from "../../lib/excel";
import type { BaseCaseAdapter } from "../BaseCaseAdapter";
import {
  SheriffCaseData,
  SheriffCasesFilterOptions,
  SheriffCaseStats,
} from "./SherriffSchema";

export interface SherriffCaseAdapter extends BaseCaseAdapter {
  getSheriffCases: (
    options?: SheriffCasesFilterOptions,
  ) => Promise<ActionResult<PaginatedResult<SheriffCaseData>>>;
  getSheriffCaseStats: (
    options?: SheriffCasesFilterOptions,
  ) => Promise<ActionResult<SheriffCaseStats>>;
  createSheriffCase: (
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  getSheriffCaseNumberPreview: (
    year: number,
  ) => Promise<ActionResult<{ caseNumber: string; nextNumber: number }>>;
  updateSheriffCase: (
    caseId: number,
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  deleteSheriffCase: (caseId: number) => Promise<ActionResult<void>>;
  getSheriffCaseById: (
    id: string | number,
  ) => Promise<ActionResult<SheriffCaseData>>;
  getSheriffCasesByIds: (
    ids: (string | number)[],
  ) => Promise<ActionResult<SheriffCaseData[]>>;
  uploadSheriffExcel: (
    file: File,
    overrideValidation?: boolean,
    overrideDuplicates?: boolean,
    overwriteDuplicates?: boolean,
    allowInFileDuplicates?: boolean,
    validateOnly?: boolean,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportSheriffExcel: () => Promise<ActionResult<ExportExcelData>>;
}
