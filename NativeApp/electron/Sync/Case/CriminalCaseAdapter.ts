import type { CriminalCaseAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import {
  getCriminalCaseById,
  getCriminalCaseNumberPreview,
  getCriminalCases,
  getCriminalCasesByIds,
  getCriminalCaseStats,
} from "./CriminalCasesActions";

export const criminalCaseAdapter: CriminalCaseAdapter = {
  doesCaseExist,
  getCases,
  getCaseStats,
  getCriminalCases,
  getCriminalCaseStats,
  createCriminalCase: () => {
    throw new Error("Not implemented in Electron");
  },
  getCriminalCaseNumberPreview,
  updateCriminalCase: () => {
    throw new Error("Not implemented in Electron");
  },
  deleteCriminalCase: () => {
    throw new Error("Not implemented in Electron");
  },
  getCriminalCaseById,
  getCriminalCasesByIds,
  uploadExcel: () => {
    throw new Error("Not implemented in Electron");
  },
  exportCasesExcel: () => {
    throw new Error("Not implemented in Electron");
  },
};

export default criminalCaseAdapter;
