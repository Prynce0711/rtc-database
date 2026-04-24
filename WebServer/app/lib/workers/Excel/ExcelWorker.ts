import { Worker } from "bullmq";
import { redisConnection } from "../../redis";
import { uploadCivilCaseExcel } from "./Case/CivilCaseExcel";
import { uploadCriminalCaseExcel } from "./Case/CriminalCaseExcel";
import { uploadPetitionCaseExcel } from "./Case/PetitionCaseExcel";
import { uploadReceivingLogExcel } from "./Case/ReceivingLogExcel";
import { uploadSheriffCaseExcel } from "./Case/SheriffCaseExcel";
import { uploadSpecialProceedingCaseExcel } from "./Case/SpecialProceedingCaseExcel";
import { uploadEmployeeExcel } from "./Employee/EmployeeExcel";
import {
  deserializeExcelFile,
  ExcelJob,
  ExcelQueueData,
  ExcelTypes,
  ExcelUploadActionResult,
  invalidJobResult,
  IS_WORKER,
  isFile,
  isSerializedExcelFile,
  QUEUE_NAME,
} from "./ExcelWorkerUtils";
import { uploadInventoryDocumentExcel } from "./Statistics/InventoryDocumentExcel";
import { uploadMonthlyStatisticsExcel } from "./Statistics/MonthlyStatisticsExcel";
import { uploadMunicipalJudgementExcel } from "./Statistics/MunicipalJudgementExcel";
import { uploadMunicipalTrialCourtExcel } from "./Statistics/MunicipalTrialCourtExcel";
import { uploadRegionalJudgementExcel } from "./Statistics/RegionalJudgementExcel";
import { uploadRegionalTrialCourtExcel } from "./Statistics/RegionalTrialCourtExcel";
import { uploadSummaryStatisticsExcel } from "./Statistics/SummaryStatisticsExcel";

const WORKER_LOCK_DURATION_MS = 10 * 60 * 1000;

IS_WORKER
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
            return uploadCriminalCaseExcel(file);
          case ExcelTypes.CIVIL_CASE:
            return uploadCivilCaseExcel(file);
          case ExcelTypes.PETITION_CASE:
            return uploadPetitionCaseExcel(file);
          case ExcelTypes.RECEIVING_LOG:
            return uploadReceivingLogExcel(file);
          case ExcelTypes.SHERIFF_CASE:
            return uploadSheriffCaseExcel(file);
          case ExcelTypes.SPECIAL_PROCEEDING_CASE:
            return uploadSpecialProceedingCaseExcel(file);
          case ExcelTypes.EMPLOYEE:
            return uploadEmployeeExcel(file);
          case ExcelTypes.MUNICIPAL_TRIAL_COURT:
            return uploadMunicipalTrialCourtExcel(file);
          case ExcelTypes.REGIONAL_TRIAL_COURT:
            return uploadRegionalTrialCourtExcel(file);
          case ExcelTypes.INVENTORY_DOCUMENT:
            return uploadInventoryDocumentExcel(file);
          case ExcelTypes.MUNICIPAL_JUDGEMENT:
            return uploadMunicipalJudgementExcel(file);
          case ExcelTypes.REGIONAL_JUDGEMENT:
            return uploadRegionalJudgementExcel(file);
          case ExcelTypes.MONTHLY_STATISTICS:
            return uploadMonthlyStatisticsExcel(file, job.data.fallbackMonth);
          case ExcelTypes.SUMMARY_STATISTICS:
            return uploadSummaryStatisticsExcel(
              file,
              job.data.fallbackMonth,
              job.data.fallbackYear,
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

if (!IS_WORKER) {
  console.log(
    "This process is not configured to run the Excel upload worker. Set IS_WORKER=true to enable it.",
  );
}
