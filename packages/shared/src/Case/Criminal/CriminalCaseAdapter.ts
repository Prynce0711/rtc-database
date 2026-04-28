import type ActionResult from "../../ActionResult";
import type { PaginatedResult } from "../../Filter/FilterTypes";
import type { Case } from "../../generated/prisma/browser";
import type {
  CaseImportConflictMode,
  ExportExcelData,
  UploadExcelResult,
} from "../../lib/excel";
import type { BaseCaseAdapter } from "../BaseCaseAdapter";
import type {
  CriminalCaseData,
  CriminalCasesFilterOptions,
  CriminalCaseStats,
} from "./CriminalCaseSchema";

export type CriminalImportConflictMode = CaseImportConflictMode;

export interface CriminalCaseAdapter extends BaseCaseAdapter {
  supportsDirectExcelUpload?: boolean;
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
  getCriminalCasesByCaseNumbers: (
    caseNumbers: string[],
  ) => Promise<ActionResult<CriminalCaseData[]>>;
  uploadExcel: (
    file: File,
    overrideValidation?: boolean,
    conflictMode?: CriminalImportConflictMode,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportCasesExcel: () => Promise<ActionResult<ExportExcelData>>;
}
