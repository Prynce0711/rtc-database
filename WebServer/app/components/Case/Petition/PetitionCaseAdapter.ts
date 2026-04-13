import type { PetitionCaseAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import { exportPetitionsExcel, uploadPetitionExcel } from "./ExcelActions";
import {
  createPetition,
  deletePetition,
  getPetitionById,
  getPetitionCaseNumberPreview,
  getPetitions,
  getPetitionsByIds,
  getPetitionStats,
  updatePetition,
} from "./PetitionActions";

export const petitionCaseAdapter: PetitionCaseAdapter = {
  doesCaseExist,
  getCases,
  getCaseStats,
  getPetitions,
  getPetitionStats,
  createPetition,
  getPetitionCaseNumberPreview,
  updatePetition,
  deletePetition,
  getPetitionById,
  getPetitionsByIds,
  uploadPetitionExcel,
  exportPetitionsExcel,
};

export default petitionCaseAdapter;
