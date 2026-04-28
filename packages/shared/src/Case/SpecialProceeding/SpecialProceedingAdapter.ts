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
  SpecialProceedingData,
  SpecialProceedingsFilterOptions,
  SpecialProceedingStats,
} from "./SpecialProceedingsSchema";

export interface SpecialProceedingAdapter extends BaseCaseAdapter {
  supportsDirectExcelUpload?: boolean;
  getSpecialProceedings: (
    options?: SpecialProceedingsFilterOptions,
  ) => Promise<ActionResult<PaginatedResult<SpecialProceedingData>>>;
  getSpecialProceedingStats: (
    options?: SpecialProceedingsFilterOptions,
  ) => Promise<ActionResult<SpecialProceedingStats>>;
  createSpecialProceeding: (
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  getSpecialProceedingCaseNumberPreview: (
    area: string,
    year: number,
  ) => Promise<ActionResult<{ caseNumber: string; nextNumber: number }>>;
  updateSpecialProceeding: (
    caseId: number,
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  deleteSpecialProceeding: (caseId: number) => Promise<ActionResult<void>>;
  getSpecialProceedingById: (
    id: string | number,
  ) => Promise<ActionResult<SpecialProceedingData>>;
  getSpecialProceedingsByIds: (
    ids: (string | number)[],
  ) => Promise<ActionResult<SpecialProceedingData[]>>;
  getSpecialProceedingsByCaseNumbers: (
    caseNumbers: string[],
  ) => Promise<ActionResult<SpecialProceedingData[]>>;
  getSpecialProceedingByCaseNumber: (
    caseNumber: string,
  ) => Promise<ActionResult<SpecialProceedingData>>;
  uploadSpecialProceedingExcel: (
    file: File,
    overrideValidation?: boolean,
    conflictMode?: CaseImportConflictMode,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportSpecialProceedingsExcel: () => Promise<ActionResult<ExportExcelData>>;
}
