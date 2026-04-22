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
  uploadSheriffExcel,
  exportSheriffExcel,
};

export default sherriffCaseAdapter;
