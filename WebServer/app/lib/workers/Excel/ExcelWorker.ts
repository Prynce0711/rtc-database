import {
  CivilCaseSchema,
  CriminalCaseSchema,
  findColumnValue,
  getExcelHeaderMap,
  getHeaderRowInfo,
  normalizeHeader,
  PetitionCaseSchema,
  ReceivingLogSchema,
  SheriffCaseSchema,
  SpecialProceedingSchema,
  VALIDATION_ERROR_MARKER,
} from "@rtc-database/shared";
import { Worker } from "bullmq";
import * as XLSX from "xlsx";
import { z } from "zod";
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

const CASE_UPLOAD_TYPES = new Set<ExcelTypes>([
  ExcelTypes.CRIMINAL_CASE,
  ExcelTypes.CIVIL_CASE,
  ExcelTypes.PETITION_CASE,
  ExcelTypes.RECEIVING_LOG,
  ExcelTypes.SHERIFF_CASE,
  ExcelTypes.SPECIAL_PROCEEDING_CASE,
]);

const CASE_TEMPLATE_CONFIG = [
  {
    type: ExcelTypes.CRIMINAL_CASE,
    label: "Criminal",
    schema: CriminalCaseSchema,
    distinctiveKeys: ["name", "charge", "infoSheet"],
  },
  {
    type: ExcelTypes.CIVIL_CASE,
    label: "Civil",
    schema: CivilCaseSchema,
    distinctiveKeys: ["originCaseNumber", "notes", "petitioners", "defendants"],
  },
  {
    type: ExcelTypes.PETITION_CASE,
    label: "Petition",
    schema: PetitionCaseSchema,
    distinctiveKeys: ["petitioner", "raffledTo", "nature"],
  },
  {
    type: ExcelTypes.SPECIAL_PROCEEDING_CASE,
    label: "Special Proceeding",
    schema: SpecialProceedingSchema,
    distinctiveKeys: ["petitioner", "respondent", "raffledTo"],
  },
  {
    type: ExcelTypes.SHERIFF_CASE,
    label: "Sheriff",
    schema: SheriffCaseSchema,
    distinctiveKeys: ["mortgagee", "mortgagor", "sheriffName"],
  },
  {
    type: ExcelTypes.RECEIVING_LOG,
    label: "Receiving Log",
    schema: ReceivingLogSchema,
    distinctiveKeys: ["bookAndPage", "content", "dateRecieved"],
  },
] as const;

const headerMatches = (header: string, alias: string) => {
  return header === alias || header.includes(alias) || alias.includes(header);
};

type TemplateConfig = (typeof CASE_TEMPLATE_CONFIG)[number];
type TemplateFieldAliases = {
  type: ExcelTypes;
  label: string;
  fields: string[][];
};

const HARD_CONFLICT_ALIASES: Partial<Record<ExcelTypes, string[][]>> = {
  [ExcelTypes.CRIMINAL_CASE]: [
    ["Petitioner", "Petitioner/s", "Petitioners"],
    ["Defendant", "Defendants", "Respondent", "Respondent/s"],
  ],
};

const getDistinctiveFieldAliases = (
  config: TemplateConfig,
): TemplateFieldAliases => {
  const schema = config.schema as unknown as z.ZodObject<z.ZodRawShape>;
  const headerMap = getExcelHeaderMap(schema) as Record<string, string[]>;
  const fields = config.distinctiveKeys
    .map((key) => {
      const aliases = headerMap[key] ?? [];
      return aliases.filter(
        (value, index, array) => array.indexOf(value) === index,
      );
    })
    .filter((aliases) => aliases.length > 0);

  return {
    type: config.type,
    label: config.label,
    fields,
  };
};

const getHeaderLookupRow = (headerRow: string[]): Record<string, unknown> => {
  return headerRow.reduce<Record<string, unknown>>((acc, header) => {
    const key = String(header ?? "").trim();
    if (key.length > 0) {
      acc[key] = true;
    }
    return acc;
  }, {});
};

const countMatchedFields = (
  headerLookupRow: Record<string, unknown>,
  normalizedHeaderRow: string[],
  fieldAliases: string[][],
) => {
  return fieldAliases.reduce((count, aliases) => {
    const fuzzyMatched =
      findColumnValue(headerLookupRow, aliases) !== undefined;
    if (fuzzyMatched) {
      return count + 1;
    }

    const normalizedAliases = aliases.map(normalizeHeader);
    const fallbackMatched = normalizedAliases.some((alias) =>
      normalizedHeaderRow.some((header) => headerMatches(header, alias)),
    );
    return fallbackMatched ? count + 1 : count;
  }, 0);
};

const validateCaseTemplateByHeaderMatch = async (
  file: File,
  selectedType: ExcelTypes,
): Promise<{ valid: true } | { valid: false; error: string }> => {
  if (!CASE_UPLOAD_TYPES.has(selectedType)) {
    return { valid: true };
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    return { valid: true };
  }

  const templateFieldAliases = CASE_TEMPLATE_CONFIG.map((config) =>
    getDistinctiveFieldAliases(config),
  );

  const expectedHeaders = templateFieldAliases.flatMap((config) =>
    config.fields.flat(),
  );

  const foreignFieldAliasesByType = new Map<ExcelTypes, string[][]>();
  for (const template of templateFieldAliases) {
    const ownAliases = template.fields.flat().map(normalizeHeader);
    const ownAliasSet = new Set(ownAliases);

    const foreignFields = templateFieldAliases
      .filter((candidate) => candidate.type !== template.type)
      .flatMap((candidate) => candidate.fields)
      .map((aliases) => {
        const filtered = aliases.filter(
          (alias) => !ownAliasSet.has(normalizeHeader(alias)),
        );
        return filtered.filter(
          (value, index, array) => array.indexOf(value) === index,
        );
      })
      .filter((aliases) => aliases.length > 0);

    foreignFieldAliasesByType.set(template.type, foreignFields);
  }

  const scoreByType = new Map<ExcelTypes, number>(
    CASE_TEMPLATE_CONFIG.map((config) => [config.type, 0]),
  );
  const penaltyByType = new Map<ExcelTypes, number>(
    CASE_TEMPLATE_CONFIG.map((config) => [config.type, 0]),
  );
  const adjustedScoreByType = new Map<ExcelTypes, number>(
    CASE_TEMPLATE_CONFIG.map((config) => [
      config.type,
      Number.NEGATIVE_INFINITY,
    ]),
  );
  const coverageByType = new Map<ExcelTypes, number>(
    CASE_TEMPLATE_CONFIG.map((config) => [config.type, 0]),
  );

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const headerInfo = getHeaderRowInfo(worksheet, expectedHeaders);
    const normalizedHeaderRow = headerInfo.headerRow
      .map(normalizeHeader)
      .filter((value) => value.length > 0);
    const headerLookupRow = getHeaderLookupRow(headerInfo.headerRow);

    const hardConflictRules = HARD_CONFLICT_ALIASES[selectedType] ?? [];
    const hardConflictCount = countMatchedFields(
      headerLookupRow,
      normalizedHeaderRow,
      hardConflictRules,
    );
    if (hardConflictCount > 0) {
      const selectedLabel =
        CASE_TEMPLATE_CONFIG.find((config) => config.type === selectedType)
          ?.label ?? selectedType;
      return {
        valid: false,
        error:
          `${VALIDATION_ERROR_MARKER}: The uploaded file has header(s) incompatible with ${selectedLabel} template ` +
          `(for example: petitioner/defendant). Please import it in the correct tab.`,
      };
    }

    for (const template of templateFieldAliases) {
      const matchedFieldCount = countMatchedFields(
        headerLookupRow,
        normalizedHeaderRow,
        template.fields,
      );

      const foreignFields = foreignFieldAliasesByType.get(template.type) ?? [];
      const foreignMatchedCount = countMatchedFields(
        headerLookupRow,
        normalizedHeaderRow,
        foreignFields,
      );

      const adjustedScore = matchedFieldCount - foreignMatchedCount;

      const totalFields = template.fields.length;
      const coverage = totalFields > 0 ? matchedFieldCount / totalFields : 0;

      const currentBestScore = scoreByType.get(template.type) ?? 0;
      if (matchedFieldCount > currentBestScore) {
        scoreByType.set(template.type, matchedFieldCount);
      }

      const currentBestCoverage = coverageByType.get(template.type) ?? 0;
      if (coverage > currentBestCoverage) {
        coverageByType.set(template.type, coverage);
      }

      const currentBestPenalty = penaltyByType.get(template.type) ?? 0;
      if (foreignMatchedCount > currentBestPenalty) {
        penaltyByType.set(template.type, foreignMatchedCount);
      }

      const currentBestAdjusted =
        adjustedScoreByType.get(template.type) ?? Number.NEGATIVE_INFINITY;
      if (adjustedScore > currentBestAdjusted) {
        adjustedScoreByType.set(template.type, adjustedScore);
      }
    }
  }

  const selectedScore = scoreByType.get(selectedType) ?? 0;
  const selectedPenalty = penaltyByType.get(selectedType) ?? 0;
  const selectedAdjustedScore =
    adjustedScoreByType.get(selectedType) ?? Number.NEGATIVE_INFINITY;
  const selectedCoverage = coverageByType.get(selectedType) ?? 0;
  const maxScore = Math.max(...Array.from(scoreByType.values()));

  const rankedTypes = CASE_TEMPLATE_CONFIG.map((config) => ({
    ...config,
    score: scoreByType.get(config.type) ?? 0,
    penalty: penaltyByType.get(config.type) ?? 0,
    adjustedScore:
      adjustedScoreByType.get(config.type) ?? Number.NEGATIVE_INFINITY,
    coverage: coverageByType.get(config.type) ?? 0,
  })).sort((a, b) => {
    if (b.adjustedScore !== a.adjustedScore)
      return b.adjustedScore - a.adjustedScore;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    return b.score - a.score;
  });

  const best = rankedTypes[0];
  if (!best) {
    return { valid: true };
  }

  // Low-signal mode: only allow if the selected type is still the strongest match.
  // This protects older templates while preventing obvious misroutes (e.g. SPC/Petition into Criminal).
  if (maxScore < 2) {
    if (best.type === selectedType || maxScore === 0) {
      return { valid: true };
    }
  }

  if (best.type === selectedType) {
    return { valid: true };
  }

  // Ambiguous match: avoid false rejections for older templates.
  if (
    selectedAdjustedScore > 0 &&
    selectedScore > 0 &&
    best.adjustedScore - selectedAdjustedScore <= 1 &&
    best.penalty >= selectedPenalty &&
    best.coverage - selectedCoverage <= 0.34 &&
    best.score - selectedScore <= 1
  ) {
    return { valid: true };
  }

  const selectedLabel =
    CASE_TEMPLATE_CONFIG.find((config) => config.type === selectedType)
      ?.label ?? selectedType;
  const likelyLabel = best.label;

  return {
    valid: false,
    error:
      `${VALIDATION_ERROR_MARKER}: The uploaded file looks like a ${likelyLabel} template, not ${selectedLabel}. ` +
      `Please import it in the correct tab.`,
  };
};

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

        if (job.data.overrideTemplateValidation) {
          console.warn(
            "WARN Template validation is overridden for this job. This may lead to misclassification if the file headers do not match the expected template.",
          );
        } else {
          const templateValidation = await validateCaseTemplateByHeaderMatch(
            file,
            jobType,
          );
          if (!templateValidation.valid) {
            return invalidJobResult(templateValidation.error);
          }
        }

        switch (jobType) {
          case ExcelTypes.CRIMINAL_CASE:
            return uploadCriminalCaseExcel(
              file,
              job.data.overrideDuplicates,
              job.data.overwriteDuplicates,
              job.data.allowInFileDuplicates,
              job.data.validateOnly,
            );
          case ExcelTypes.CIVIL_CASE:
            return uploadCivilCaseExcel(
              file,
              job.data.overrideDuplicates,
              job.data.overwriteDuplicates,
              job.data.allowInFileDuplicates,
              job.data.validateOnly,
            );
          case ExcelTypes.PETITION_CASE:
            return uploadPetitionCaseExcel(
              file,
              job.data.overrideDuplicates,
              job.data.overwriteDuplicates,
              job.data.allowInFileDuplicates,
              job.data.validateOnly,
            );
          case ExcelTypes.RECEIVING_LOG:
            return uploadReceivingLogExcel(
              file,
              job.data.overrideDuplicates,
              job.data.overwriteDuplicates,
              job.data.allowInFileDuplicates,
              job.data.validateOnly,
            );
          case ExcelTypes.SHERIFF_CASE:
            return uploadSheriffCaseExcel(
              file,
              job.data.overrideDuplicates,
              job.data.overwriteDuplicates,
              job.data.allowInFileDuplicates,
              job.data.validateOnly,
            );
          case ExcelTypes.SPECIAL_PROCEEDING_CASE:
            return uploadSpecialProceedingCaseExcel(
              file,
              job.data.overrideDuplicates,
              job.data.overwriteDuplicates,
              job.data.allowInFileDuplicates,
              job.data.validateOnly,
            );
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
