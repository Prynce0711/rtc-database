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
  uploadSheriffExcel,
  exportSheriffExcel,
};

export default sherriffCaseAdapter;
