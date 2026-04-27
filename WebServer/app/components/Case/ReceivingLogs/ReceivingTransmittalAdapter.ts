"use client";

import type { RecievingLogsAdapter } from "@rtc-database/shared";
import {
  exportReceivingTransmittalsExcel,
  getReceivingTransmittalsPage,
  getReceivingTransmittalStats,
} from "./ReceivingTransmittalActions";

type ReceivingTransmittalAdapter = Pick<
  RecievingLogsAdapter,
  "getRecievingLogsPage" | "getRecievingLogsStats" | "exportReceiveLogsExcel"
>;

export const receivingTransmittalAdapter: ReceivingTransmittalAdapter = {
  getRecievingLogsPage: getReceivingTransmittalsPage,
  getRecievingLogsStats: getReceivingTransmittalStats,
  exportReceiveLogsExcel: exportReceivingTransmittalsExcel,
};

export default receivingTransmittalAdapter;
