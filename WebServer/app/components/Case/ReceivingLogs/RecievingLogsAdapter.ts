import type { RecievingLogsAdapter } from "@rtc-database/shared";
import { exportReceiveLogsExcel, uploadReceiveExcel } from "./ExcelActions";
import {
  createRecievingLog,
  deleteRecievingLog,
  getRecievingLogById,
  getRecievingLogsByIds,
  getRecievingLogsPage,
  getRecievingLogsStats,
  updateRecievingLog,
} from "./RecievingLogsActions";

export const recievingLogsAdapter: RecievingLogsAdapter = {
  getRecievingLogsPage,
  getRecievingLogsStats,
  createRecievingLog,
  updateRecievingLog,
  deleteRecievingLog,
  getRecievingLogById,
  getRecievingLogsByIds,
  uploadReceiveExcel,
  exportReceiveLogsExcel,
};

export default recievingLogsAdapter;
