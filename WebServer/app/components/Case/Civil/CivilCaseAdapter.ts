"use client";

import type { CivilCaseAdapter } from "@rtc-database/shared";
import { CaseType } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import {
  createCivilCase,
  deleteCivilCase,
  getCivilCaseById,
  getCivilCaseNumberPreview,
  getCivilCases,
  getCivilCasesByCaseNumbers,
  getCivilCasesByIds,
  getCivilCaseStats,
  updateCivilCase,
} from "./CivilActions";
import { exportCasesExcel, uploadExcel } from "./ExcelActions";

export const civilCaseAdapter: CivilCaseAdapter = {
  supportsDirectExcelUpload: true,
  doesCaseExist,
  getCases,
  getCaseStats,
  getCivilCases,
  getCivilCaseStats,
  createCivilCase,
  getCivilCaseNumberPreview,
  updateCivilCase,
  deleteCivilCase,
  getCivilCaseById,
  getCivilCasesByIds,
  getCivilCasesByCaseNumbers,
  uploadExcel: (file, overrideValidation, conflictMode) =>
    uploadExcel(file, CaseType.CIVIL, overrideValidation, conflictMode),
  exportCasesExcel,
};

export default civilCaseAdapter;
