"use client";

import type { SherriffCaseAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import { exportSheriffExcel, uploadSheriffExcel } from "./ExcelActions";
import {
  createSheriffCase,
  deleteSheriffCase,
  getSheriffCaseById,
  getSheriffCaseNumberPreview,
  getSheriffCases,
  getSheriffCasesByCaseNumbers,
  getSheriffCasesByIds,
  getSheriffCaseStats,
  updateSheriffCase,
} from "./SherriffActions";

export const sherriffCaseAdapter: SherriffCaseAdapter = {
  supportsDirectExcelUpload: true,
  doesCaseExist,
  getCases,
  getCaseStats,
  getSheriffCases,
  getSheriffCaseStats,
  createSheriffCase,
  getSheriffCaseNumberPreview,
  updateSheriffCase,
  deleteSheriffCase,
  getSheriffCaseById,
  getSheriffCasesByIds,
  getSheriffCasesByCaseNumbers,
  uploadSheriffExcel: (file, overrideValidation, conflictMode) =>
    uploadSheriffExcel(file, overrideValidation, conflictMode),
  exportSheriffExcel,
};

export default sherriffCaseAdapter;
