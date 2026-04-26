import type ActionResult from "../../ActionResult";
import type { PaginatedResult } from "../../Filter/FilterTypes";
import type { Case } from "../../generated/prisma/browser";
import type { ExportExcelData, UploadExcelResult } from "../../lib/excel";
import type { BaseCaseAdapter } from "../BaseCaseAdapter";
import type {
  CriminalCaseData,
  CriminalCasesFilterOptions,
  CriminalCaseStats,
} from "./CriminalCaseSchema";

export interface CriminalCaseAdapter extends BaseCaseAdapter {
  getCriminalCases: (
    options?: CriminalCasesFilterOptions,
  ) => Promise<ActionResult<PaginatedResult<CriminalCaseData>>>;
  getCriminalCaseStats: (
    options?: CriminalCasesFilterOptions,
  ) => Promise<ActionResult<CriminalCaseStats>>;
  createCriminalCase: (
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  getCriminalCaseNumberPreview: (
    area: string,
    year: number,
  ) => Promise<ActionResult<{ caseNumber: string; nextNumber: number }>>;
  updateCriminalCase: (
    caseId: number,
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  deleteCriminalCase: (caseId: number) => Promise<ActionResult<void>>;
  getCriminalCaseById: (
    id: string | number,
  ) => Promise<ActionResult<CriminalCaseData>>;
  getCriminalCasesByIds: (
    ids: (string | number)[],
  ) => Promise<ActionResult<CriminalCaseData[]>>;
  uploadExcel: (
    file: File,
    overrideValidation?: boolean,
    overrideDuplicates?: boolean,
    overwriteDuplicates?: boolean,
    allowInFileDuplicates?: boolean,
    validateOnly?: boolean,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportCasesExcel: () => Promise<ActionResult<ExportExcelData>>;
}
