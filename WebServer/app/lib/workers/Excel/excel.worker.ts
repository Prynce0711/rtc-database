import type { ActionResult, UploadExcelResult } from "@rtc-database/shared";
import { Job, Queue, QueueEvents, Worker } from "bullmq";
import { redisConnection } from "../../redis";
import { uploadCriminalCaseExcel } from "./CriminalCaseExcel";

const QUEUE_NAME = "excelQueue";
const JOB_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
const WORKER_LOCK_DURATION_MS = 10 * 60 * 1000;
const ENABLE_WORKER = process.env.ENABLE_WORKER === "true";

type ExcelUploadActionResult = ActionResult<
  UploadExcelResult,
  UploadExcelResult
>;

export enum ExcelTypes {
  CRIMINAL_CASE = "CRIMINAL_CASE",
  CIVIL_CASE = "CIVIL_CASE",
}

type CriminalCaseExcelJobData = {
  type: ExcelTypes.CRIMINAL_CASE;
  file: File;
};

type CivilCaseExcelJobData = {
  type: ExcelTypes.CIVIL_CASE;
  file: File;
};

export type ExcelJobData = CriminalCaseExcelJobData | CivilCaseExcelJobData;

type SerializedExcelFile = {
  name: string;
  type: string;
  lastModified: number;
  size: number;
  bytesBase64: string;
};

type CriminalCaseExcelQueueData = {
  type: ExcelTypes.CRIMINAL_CASE;
  file: SerializedExcelFile;
};

type CivilCaseExcelQueueData = {
  type: ExcelTypes.CIVIL_CASE;
  file: SerializedExcelFile;
};

type ExcelQueueData = CriminalCaseExcelQueueData | CivilCaseExcelQueueData;

type ExcelJob = Job<ExcelQueueData, ExcelUploadActionResult, typeof QUEUE_NAME>;

const invalidJobResult = (error: string): ExcelUploadActionResult => ({
  success: false,
  error,
});

const isFile = (value: unknown): value is File => value instanceof File;

const isSerializedExcelFile = (
  value: unknown,
): value is SerializedExcelFile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SerializedExcelFile>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.lastModified === "number" &&
    typeof candidate.size === "number" &&
    typeof candidate.bytesBase64 === "string"
  );
};

const serializeExcelFile = async (file: File): Promise<SerializedExcelFile> => {
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    size: bytes.byteLength,
    bytesBase64: bytes.toString("base64"),
  };
};

const deserializeExcelFile = (data: SerializedExcelFile): File => {
  const bytes = Buffer.from(data.bytesBase64, "base64");
  return new File([bytes], data.name, {
    type: data.type,
    lastModified: data.lastModified,
  });
};

const serializeExcelJobData = async (
  data: ExcelJobData,
): Promise<ExcelQueueData> => ({
  ...data,
  file: await serializeExcelFile(data.file),
});

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
