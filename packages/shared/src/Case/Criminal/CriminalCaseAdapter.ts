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
import type {
  CriminalAppealedCaseData,
  CriminalAppealedCaseInput,
} from "./CriminalAppealedCaseSchema";

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
  getCriminalAppealedCases?: () => Promise<
    ActionResult<CriminalAppealedCaseData[]>
  >;
  getCriminalAppealedCaseById?: (
    id: string | number,
  ) => Promise<ActionResult<CriminalAppealedCaseData>>;
  createCriminalAppealedCase?: (
    data: Partial<CriminalAppealedCaseInput>,
  ) => Promise<ActionResult<CriminalAppealedCaseData>>;
  updateCriminalAppealedCase?: (
    id: number,
    data: Partial<CriminalAppealedCaseInput>,
  ) => Promise<ActionResult<CriminalAppealedCaseData>>;
  deleteCriminalAppealedCase?: (id: number) => Promise<ActionResult<void>>;
  uploadExcel: (
    file: File,
    overrideValidation?: boolean,
    conflictMode?: CriminalImportConflictMode,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportCasesExcel: () => Promise<ActionResult<ExportExcelData>>;
}
