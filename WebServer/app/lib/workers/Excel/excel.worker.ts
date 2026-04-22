import { Queue, QueueEvents, Worker } from "bullmq";
import { redisConnection } from "../../redis";
import { uploadCriminalCaseExcel } from "./CriminalCaseExcel";
import {
  ExcelQueueData,
  ExcelUploadActionResult,
  QUEUE_NAME,
  ExcelJobData,
  isFile,
  invalidJobResult,
  serializeExcelJobData,
  ExcelJob,
  isSerializedExcelFile,
  deserializeExcelFile,
  ExcelTypes,
} from "./ExcelWorkerUtils";

const JOB_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
const WORKER_LOCK_DURATION_MS = 10 * 60 * 1000;
const ENABLE_WORKER = process.env.ENABLE_WORKER === "true";

const excelQueue = new Queue<
  ExcelQueueData,
  ExcelUploadActionResult,
  typeof QUEUE_NAME
>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

const excelQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnection,
});

export const startExcelUpload = async (
  data: ExcelJobData,
): Promise<ExcelUploadActionResult> => {
  if (!isFile(data.file)) {
    return invalidJobResult("Invalid file data");
  }

  const queueData = await serializeExcelJobData(data);
  const job = await excelQueue.add(QUEUE_NAME, queueData);

  try {
    await excelQueueEvents.waitUntilReady();
    return await job.waitUntilFinished(excelQueueEvents, JOB_WAIT_TIMEOUT_MS);
  } catch (error) {
    console.error("Excel upload queue failed:", error);
    return invalidJobResult(
      error instanceof Error ? error.message : "Excel upload job failed",
    );
  }
};

const worker = ENABLE_WORKER
  ? new Worker<ExcelQueueData, ExcelUploadActionResult, typeof QUEUE_NAME>(
      QUEUE_NAME,
      async (job: ExcelJob): Promise<ExcelUploadActionResult> => {
        console.log(`Received job ${job.id} of type ${job.data.type}`);
        console.log("Job file payload metadata:", {
          name: job.data.file?.name,
          size: job.data.file?.size,
          type: job.data.file?.type,
        });

        if (!isSerializedExcelFile(job.data.file)) {
          console.warn(
            "WARN Received job with invalid file data:",
            job.data.file,
          );
          return invalidJobResult("Invalid file data");
        }

        let file: File;
        try {
          file = deserializeExcelFile(job.data.file);
        } catch (error) {
          console.warn("WARN Failed to deserialize job file data:", error);
          return invalidJobResult("Invalid serialized file data");
        }

        if (!isFile(file)) {
          return invalidJobResult("Unable to recreate uploaded file");
        }

        console.log(`Recreated file ${file.name} (${file.size} bytes)`);

        const jobType = job.data.type;

        switch (jobType) {
          case ExcelTypes.CRIMINAL_CASE:
            // Delegate to the existing function for processing criminal case Excel files.
            return uploadCriminalCaseExcel(file);
          case ExcelTypes.CIVIL_CASE:
            return invalidJobResult(
              "Civil case Excel upload not implemented yet",
            );
          default:
            return invalidJobResult(
              `Unhandled excel upload type: ${String(jobType)}`,
            );
        }
      },
      {
        connection: redisConnection,
        concurrency: 1,
        lockDuration: WORKER_LOCK_DURATION_MS,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    )
  : null;

if (!ENABLE_WORKER) {
  console.log(
    "Excel worker not started in this process (set ENABLE_WORKER=true in worker runtime).",
  );
}

export default worker;
