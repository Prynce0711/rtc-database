"use client";

import type { SherriffCaseAdapter } from "@rtc-database/shared";
import {
  exportSheriffTransmittalsExcel,
  getSheriffTransmittalStats,
  getSheriffTransmittals,
} from "./SherriffTransmittalActions";

type SherriffCaseTransmittalAdapter = Pick<
  SherriffCaseAdapter,
  "getSheriffCases" | "getSheriffCaseStats" | "exportSheriffExcel"
>;

export const sherriffCaseTransmittalAdapter: SherriffCaseTransmittalAdapter = {
  getSheriffCases: getSheriffTransmittals,
  getSheriffCaseStats: getSheriffTransmittalStats,
  exportSheriffExcel: exportSheriffTransmittalsExcel,
};

export default sherriffCaseTransmittalAdapter;
