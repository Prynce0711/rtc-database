"use client";

import type { CriminalCaseAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import {
  createCriminalCase,
  deleteCriminalCase,
  getCriminalCaseById,
  getCriminalCaseNumberPreview,
  getCriminalCases,
  getCriminalCasesByCaseNumbers,
  getCriminalCasesByIds,
  getCriminalCaseStats,
  updateCriminalCase,
} from "./CriminalCasesActions";
import {
  createCriminalAppealedCase,
  deleteCriminalAppealedCase,
  getCriminalAppealedCaseById,
  getCriminalAppealedCases,
  updateCriminalAppealedCase,
} from "./CriminalAppealedActions";
import { exportCasesExcel, uploadCriminalCaseExcel } from "./ExcelActions";

export const criminalCaseAdapter: CriminalCaseAdapter = {
  supportsDirectExcelUpload: true,
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
  getCriminalCasesByCaseNumbers,
  getCriminalAppealedCases,
  getCriminalAppealedCaseById,
  createCriminalAppealedCase,
  updateCriminalAppealedCase,
  deleteCriminalAppealedCase,
  uploadExcel: uploadCriminalCaseExcel,
  exportCasesExcel,
};

export default criminalCaseAdapter;
