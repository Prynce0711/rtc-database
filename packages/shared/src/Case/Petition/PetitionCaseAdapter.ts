import type ActionResult from "../../ActionResult";
import type { PaginatedResult } from "../../Filter/FilterTypes";
import type { Case } from "../../generated/prisma/browser";
import type { ExportExcelData, UploadExcelResult } from "../../lib/excel";
import type { BaseCaseAdapter } from "../BaseCaseAdapter";
import type {
  PetitionCaseData,
  PetitionCaseStats,
  PetitionCasesFilterOptions,
} from "./PetitionCaseSchema";

export interface PetitionCaseAdapter extends BaseCaseAdapter {
  getPetitions: (
    options?: PetitionCasesFilterOptions,
  ) => Promise<ActionResult<PaginatedResult<PetitionCaseData>>>;
  getPetitionStats: (
    options?: PetitionCasesFilterOptions,
  ) => Promise<ActionResult<PetitionCaseStats>>;
  createPetition: (
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  getPetitionCaseNumberPreview: (
    area: string,
    year: number,
  ) => Promise<ActionResult<{ caseNumber: string; nextNumber: number }>>;
  updatePetition: (
    caseId: number,
    data: Record<string, unknown>,
  ) => Promise<ActionResult<Case>>;
  deletePetition: (caseId: number) => Promise<ActionResult<void>>;
  getPetitionById: (
    id: string | number,
  ) => Promise<ActionResult<PetitionCaseData>>;
  getPetitionsByIds: (
    ids: (string | number)[],
  ) => Promise<ActionResult<PetitionCaseData[]>>;
  getPetitionsByCaseNumbers: (
    caseNumbers: string[],
  ) => Promise<ActionResult<PetitionCaseData[]>>;
  uploadPetitionExcel: (
    file: File,
    overrideValidation?: boolean,
  ) => Promise<ActionResult<UploadExcelResult, UploadExcelResult>>;
  exportPetitionsExcel: () => Promise<ActionResult<ExportExcelData>>;
}
