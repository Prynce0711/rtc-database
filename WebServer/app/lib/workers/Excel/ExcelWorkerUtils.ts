import { ActionResult, UploadExcelResult } from "@rtc-database/shared";
import { Job } from "bullmq";

export type ExcelUploadActionResult = ActionResult<
  UploadExcelResult,
  UploadExcelResult
>;
export const QUEUE_NAME = "excelQueue";

export enum ExcelTypes {
  CRIMINAL_CASE = "CRIMINAL_CASE",
  CIVIL_CASE = "CIVIL_CASE",
}

type ExcelJobPayload<TFile> = {
  type: ExcelTypes;
  file: TFile;
};

export type ExcelJobData<TFile = File> = ExcelJobPayload<TFile>;

export type SerializedExcelFile = {
  name: string;
  type: string;
  lastModified: number;
  size: number;
  bytesBase64: string;
};

export type ExcelQueueData = ExcelJobData<SerializedExcelFile>;

export type ExcelJob = Job<
  ExcelQueueData,
  ExcelUploadActionResult,
  typeof QUEUE_NAME
>;

export const invalidJobResult = (error: string): ExcelUploadActionResult => ({
  success: false,
  error,
});

export const isFile = (value: unknown): value is File => value instanceof File;

export const isSerializedExcelFile = (
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

export const serializeExcelFile = async (
  file: File,
): Promise<SerializedExcelFile> => {
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    size: bytes.byteLength,
    bytesBase64: bytes.toString("base64"),
  };
};

export const deserializeExcelFile = (data: SerializedExcelFile): File => {
  const bytes = Buffer.from(data.bytesBase64, "base64");
  return new File([bytes], data.name, {
    type: data.type,
    lastModified: data.lastModified,
  });
};

export const serializeExcelJobData = async (
  data: ExcelJobData,
): Promise<ExcelQueueData> => ({
  ...data,
  file: await serializeExcelFile(data.file),
});

export type ExcelProgress = {
  id: number;
  fileName: string;
  progress: number; // 0 to 100
  status: "pending" | "processing" | "completed" | "error";
  errorMessage?: string;
};

export const PROGRESS_KEY_PREFIX = "excel_upload_progress:";

export const getProgressKey = (uploadId: number) => {
  return `${PROGRESS_KEY_PREFIX}${uploadId}`;
};
