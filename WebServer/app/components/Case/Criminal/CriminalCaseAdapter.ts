"use client";

import type { CriminalCaseAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import {
  createCriminalCase,
  deleteCriminalCase,
  getCriminalCaseById,
  getCriminalCaseNumberPreview,
  getCriminalCases,
  getCriminalCasesByIds,
  getCriminalCaseStats,
  updateCriminalCase,
} from "./CriminalCasesActions";
import { exportCasesExcel, uploadCriminalCaseExcel } from "./ExcelActions";

export const criminalCaseAdapter: CriminalCaseAdapter = {
  doesCaseExist,
  getCases,
  getCaseStats,
  getCriminalCases,
  getCriminalCaseStats,
  createCriminalCase,
  getCriminalCaseNumberPreview,
  updateCriminalCase,
  deleteCriminalCase,
  getCriminalCaseById,
  getCriminalCasesByIds,
  uploadExcel: (
    file,
    overrideValidation,
    overrideDuplicates,
    overwriteDuplicates,
    allowInFileDuplicates,
    validateOnly,
  ) =>
    uploadCriminalCaseExcel(
      file,
      overrideValidation,
      overrideDuplicates,
      overwriteDuplicates,
      allowInFileDuplicates,
      validateOnly,
    ),
  exportCasesExcel,
};

export default criminalCaseAdapter;
