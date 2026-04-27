"use client";

import type { SpecialProceedingAdapter } from "@rtc-database/shared";
import {
  exportSpecialProceedingTransmittalsExcel,
  getSpecialProceedingTransmittals,
  getSpecialProceedingTransmittalStats,
} from "./SpecialProceedingTransmittalActions";

type SpecialProceedingTransmittalAdapter = Pick<
  SpecialProceedingAdapter,
  | "getSpecialProceedings"
  | "getSpecialProceedingStats"
  | "exportSpecialProceedingsExcel"
>;

export const specialProceedingTransmittalAdapter: SpecialProceedingTransmittalAdapter =
  {
    getSpecialProceedings: getSpecialProceedingTransmittals,
    getSpecialProceedingStats: getSpecialProceedingTransmittalStats,
    exportSpecialProceedingsExcel: exportSpecialProceedingTransmittalsExcel,
  };

export default specialProceedingTransmittalAdapter;
