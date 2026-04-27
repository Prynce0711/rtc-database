"use client";

import type { CivilCaseAdapter } from "@rtc-database/shared";
import {
  exportCivilTransmittalsExcel,
  getCivilTransmittalStats,
  getCivilTransmittals,
} from "./CivilTransmittalActions";

type CivilCaseTransmittalAdapter = Pick<
  CivilCaseAdapter,
  "getCivilCases" | "getCivilCaseStats" | "exportCasesExcel"
>;

export const civilCaseTransmittalAdapter: CivilCaseTransmittalAdapter = {
  getCivilCases: getCivilTransmittals,
  getCivilCaseStats: getCivilTransmittalStats,
  exportCasesExcel: exportCivilTransmittalsExcel,
};

export default civilCaseTransmittalAdapter;
