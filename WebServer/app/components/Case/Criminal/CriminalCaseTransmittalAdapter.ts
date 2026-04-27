"use client";

import type { CriminalCaseAdapter } from "@rtc-database/shared";
import {
  exportCriminalTransmittalsExcel,
  getCriminalTransmittalStats,
  getCriminalTransmittals,
} from "./CriminalTransmittalActions";

type CriminalCaseTransmittalAdapter = Pick<
  CriminalCaseAdapter,
  "getCriminalCases" | "getCriminalCaseStats" | "exportCasesExcel"
>;

export const criminalCaseTransmittalAdapter: CriminalCaseTransmittalAdapter = {
  getCriminalCases: getCriminalTransmittals,
  getCriminalCaseStats: getCriminalTransmittalStats,
  exportCasesExcel: exportCriminalTransmittalsExcel,
};

export default criminalCaseTransmittalAdapter;
