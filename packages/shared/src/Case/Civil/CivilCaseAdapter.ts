import type ActionResult from "../../ActionResult";
import type { PaginatedResult } from "../../Filter/FilterTypes";
import type { Case } from "../../generated/prisma/browser";
import type { ExportExcelData, UploadExcelResult } from "../../lib/excel";
import type { BaseCaseAdapter } from "../BaseCaseAdapter";
import type {
  CivilCaseData,
  CivilCasesFilterOptions,
  CivilCaseStats,
} from "./CivilCaseSchema";

export interface CivilCaseAdapter extends BaseCaseAdapter {
  getCivilCases: (
    options?: CivilCasesFilterOptions,
  ) => Promise<ActionResult<PaginatedResult<CivilCaseData>>>;
  getCivilCaseStats: (
    options?: CivilCasesFilterOptions,
  ) => Promise<ActionResult<CivilCaseStats>>;
  createCivilCase: (
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  getCivilCaseNumberPreview: (
    area: string,
    year: number,
  ) => Promise<ActionResult<{ caseNumber: string; nextNumber: number }>>;
  updateCivilCase: (
    caseId: number,
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  deleteCivilCase: (caseId: number) => Promise<ActionResult<void>>;
  getCivilCaseById: (
    id: string | number,
  ) => Promise<ActionResult<CivilCaseData>>;
  getCivilCasesByIds: (
    ids: (string | number)[],
  ) => Promise<ActionResult<CivilCaseData[]>>;
  getCivilCasesByCaseNumbers: (
    caseNumbers: string[],
  ) => Promise<ActionResult<CivilCaseData[]>>;
  uploadExcel: (
    file: File,
    overrideValidation?: boolean,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportCasesExcel: () => Promise<ActionResult<ExportExcelData>>;
}
