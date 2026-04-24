"use server";

import {
  addExcelJob,
  getExcelQueueEvents,
  getWorkersCount,
} from "./ExcelQueue";
import {
  ExcelJobData,
  ExcelUploadActionResult,
  invalidJobResult,
  isFile,
  serializeExcelJobData,
} from "./ExcelWorkerUtils";

const JOB_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

export const startExcelUpload = async (
  data: ExcelJobData,
): Promise<ExcelUploadActionResult> => {
  if (!isFile(data.file)) {
    return invalidJobResult("Invalid file data");
  }

  if ((await getWorkersCount()) < 1) {
    console.log("Excel uploader has no workers");
    return {
      success: false,
      error: "Excel uploader has no workers",
    };
  }

  const queueData = await serializeExcelJobData(data);

  const job = await addExcelJob(queueData);
  const queueEvents = getExcelQueueEvents();

  try {
    await queueEvents.waitUntilReady();
    return await job.waitUntilFinished(queueEvents, JOB_WAIT_TIMEOUT_MS);
  } catch (error) {
    console.error("Excel upload queue failed:", error);
    return invalidJobResult(
      error instanceof Error ? error.message : "Excel upload job failed",
    );
  }
};
