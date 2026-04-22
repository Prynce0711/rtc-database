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
import { exportCasesExcel, uploadExcel } from "./ExcelActions";

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
  uploadExcel,
  exportCasesExcel,
};

export default criminalCaseAdapter;
