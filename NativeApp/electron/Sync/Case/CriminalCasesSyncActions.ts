import {
  BaseCaseSchema,
  CriminalCaseSchema,
  type UpsertCriminalCasesResponse,
  type UpsertCriminalCasesResult,
} from "@rtc-database/shared";
import { prettifyError, z } from "zod";
import { prisma } from "../../prisma";

const UPSERT_CHUNK_SIZE = 100;

const yieldToEventLoop = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
};

const CasePayloadSchema = BaseCaseSchema.extend({
  id: z.number().int().positive(),
  caseType: z.literal("CRIMINAL"),
  number: z.number().int().nullable().optional(),
  area: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  isManual: z.boolean().optional(),
});

const CriminalCasePayloadSchema = CriminalCaseSchema.omit({
  branch: true,
  assistantBranch: true,
  caseNumber: true,
  dateFiled: true,
  caseType: true,
}).extend({
  id: z.number().int().positive(),
  baseCaseID: z.number().int().positive(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().nullable().optional(),
});

const CriminalCaseRecordPayloadSchema = z.object({
  case: CasePayloadSchema,
  criminalCase: CriminalCasePayloadSchema,
});

const UpsertCriminalCasesPayloadSchema = z.object({
  source: z.string().optional(),
  sentAt: z.string().optional(),
  casesData: z.array(CriminalCaseRecordPayloadSchema).min(1),
});

const payloadError = (error: string): UpsertCriminalCasesResponse => ({
  success: false,
  error,
});

const normalizeCaseData = (
  caseData: z.infer<typeof CriminalCaseRecordPayloadSchema>,
) => {
  const { case: baseCase, criminalCase: rawCriminalCase } = caseData;

  const caseNumber = baseCase.caseNumber.trim();
  if (!caseNumber) {
    return { error: "Payload.caseData.caseNumber is required." };
  }

  const name = rawCriminalCase.name.trim();
  if (!name) {
    return { error: "Payload.caseData.name is required." };
  }

  const {
    id: _criminalCaseId,
    baseCaseID: _baseCaseID,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...criminalCaseUpsertData
  } = rawCriminalCase;
  criminalCaseUpsertData.name = name;

  const normalizedBranch =
    typeof baseCase.branch === "string" && baseCase.branch.trim().length > 0
      ? baseCase.branch.trim()
      : null;
  const normalizedAssistantBranch =
    typeof baseCase.assistantBranch === "string" &&
    baseCase.assistantBranch.trim().length > 0
      ? baseCase.assistantBranch.trim()
      : null;
  const normalizedArea =
    typeof baseCase.area === "string" && baseCase.area.trim().length > 0
      ? baseCase.area.trim()
      : null;

  return {
    caseId: baseCase.id,
    caseNumber,
    caseUpsertData: {
      caseType: "CRIMINAL" as const,
      branch: normalizedBranch,
      assistantBranch: normalizedAssistantBranch,
      caseNumber,
      number: baseCase.number ?? null,
      area: normalizedArea,
      year: baseCase.year ?? null,
      isManual: baseCase.isManual ?? false,
      dateFiled: baseCase.dateFiled ?? null,
    },
    criminalCaseUpsertData,
  };
};

export const upsertCriminalCases = async (
  payload: unknown,
): Promise<UpsertCriminalCasesResponse> => {
  try {
    const parsedPayload = UpsertCriminalCasesPayloadSchema.safeParse(payload);

    if (!parsedPayload.success) {
      return payloadError(
        `Invalid sync payload: ${prettifyError(parsedPayload.error)}`,
      );
    }

    const payloadData = parsedPayload.data;
    const source =
      payloadData.source && payloadData.source.trim().length > 0
        ? payloadData.source.trim()
        : "unknown";
    const sentAt =
      payloadData.sentAt && payloadData.sentAt.trim().length > 0
        ? payloadData.sentAt.trim()
        : null;

    const normalizedCases = payloadData.casesData.map((caseData) =>
      normalizeCaseData(caseData),
    );
    const invalidCase = normalizedCases.find(
      (item): item is { error: string } => "error" in item,
    );
    if (invalidCase) {
      return payloadError(invalidCase.error);
    }

    console.log("[sync:criminal] Electron received batch sync payload.", {
      source,
      sentAt,
      batchSize: normalizedCases.length,
    });

    let syncedCount = 0;

    // Keep transactions short so SQLite write locks do not stall the app for long bursts.
    for (
      let startIndex = 0;
      startIndex < normalizedCases.length;
      startIndex += UPSERT_CHUNK_SIZE
    ) {
      const chunk = normalizedCases.slice(
        startIndex,
        startIndex + UPSERT_CHUNK_SIZE,
      );

      const chunkSyncedCount = await prisma.$transaction(async (tx) => {
        let upsertedCount = 0;

        for (const item of chunk) {
          if ("error" in item) {
            continue;
          }

          await tx.case.upsert({
            where: { id: item.caseId },
            create: {
              id: item.caseId,
              ...item.caseUpsertData,
            },
            update: item.caseUpsertData,
          });

          await tx.criminalCase.upsert({
            where: { baseCaseID: item.caseId },
            create: {
              baseCaseID: item.caseId,
              ...item.criminalCaseUpsertData,
            },
            update: item.criminalCaseUpsertData,
          });

          upsertedCount += 1;
        }

        return upsertedCount;
      });

      syncedCount += chunkSyncedCount;

      const hasMoreChunks =
        startIndex + UPSERT_CHUNK_SIZE < normalizedCases.length;
      if (hasMoreChunks) {
        await yieldToEventLoop();
      }
    }

    const result: UpsertCriminalCasesResult = {
      syncedCount,
      syncedAt: new Date().toISOString(),
    };

    console.log("[sync:criminal] Electron batch upsert complete.", {
      source,
      sentAt,
      ...result,
    });

    return {
      success: true,
      result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";
    console.error("[sync:criminal] Unexpected Electron sync error.", error);

    return {
      success: false,
      error: message,
    };
  }
};
