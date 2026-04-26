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
  getCivilCasesByIds,
  getCivilCaseStats,
  updateCivilCase,
} from "./CivilActions";
import { exportCasesExcel, uploadExcel } from "./ExcelActions";

export const civilCaseAdapter: CivilCaseAdapter = {
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
  uploadExcel: (
    file,
    overrideValidation,
    overrideDuplicates,
    overwriteDuplicates,
    allowInFileDuplicates,
    validateOnly,
  ) =>
    uploadExcel(
      file,
      CaseType.CIVIL,
      overrideValidation,
      overrideDuplicates,
      overwriteDuplicates,
      allowInFileDuplicates,
      validateOnly,
    ),
  exportCasesExcel,
};

export default civilCaseAdapter;
