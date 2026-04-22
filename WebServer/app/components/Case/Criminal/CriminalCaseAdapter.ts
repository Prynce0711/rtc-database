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
  uploadExcel: uploadCriminalCaseExcel,
  exportCasesExcel,
};

export default criminalCaseAdapter;
