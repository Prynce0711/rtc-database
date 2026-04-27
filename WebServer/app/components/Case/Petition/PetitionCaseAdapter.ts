"use client";

import type { PetitionCaseAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import { exportPetitionsExcel, uploadPetitionExcel } from "./ExcelActions";
import {
  createPetition,
  deletePetition,
  getPetitionById,
  getPetitionCaseNumberPreview,
  getPetitionsByCaseNumbers,
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
  getPetitionsByCaseNumbers,
  uploadPetitionExcel,
  exportPetitionsExcel,
};

export default petitionCaseAdapter;
