import {
  CriminalCaseSchema,
  type UpsertSingleCriminalCaseResponse,
  type UpsertSingleCriminalCaseResult,
} from "@rtc-database/shared";
import { prettifyError, z } from "zod";
import { prisma } from "../../prisma";

const UpsertSingleCriminalCasePayloadSchema = z.object({
  source: z.string().optional(),
  sentAt: z.string().optional(),
  caseData: CriminalCaseSchema.extend({
    id: z.number().int().positive(),
    caseType: z.literal("CRIMINAL"),
    number: z.number().int().nullable().optional(),
    area: z.string().nullable().optional(),
    year: z.number().int().nullable().optional(),
    isManual: z.boolean().optional(),
  }),
});

const payloadError = (error: string): UpsertSingleCriminalCaseResponse => ({
  success: false,
  error,
});

export const upsertSingleCriminalCase = async (
  payload: unknown,
): Promise<UpsertSingleCriminalCaseResponse> => {
  try {
    const parsedPayload =
      UpsertSingleCriminalCasePayloadSchema.safeParse(payload);

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

    const {
      id: caseId,
      number,
      area,
      year,
      isManual = false,
      ...validatedCaseData
    } = payloadData.caseData;

    const {
      caseType: _caseType,
      branch,
      assistantBranch,
      caseNumber: rawCaseNumber,
      dateFiled,
      ...criminalCaseUpsertData
    } = validatedCaseData;

    const caseNumber = rawCaseNumber.trim();
    if (!caseNumber) {
      return payloadError("Payload.caseData.caseNumber is required.");
    }

    const name = criminalCaseUpsertData.name.trim();
    if (!name) {
      return payloadError("Payload.caseData.name is required.");
    }
    criminalCaseUpsertData.name = name;

    const normalizedBranch =
      typeof branch === "string" && branch.trim().length > 0
        ? branch.trim()
        : null;
    const normalizedAssistantBranch =
      typeof assistantBranch === "string" && assistantBranch.trim().length > 0
        ? assistantBranch.trim()
        : null;
    const normalizedArea =
      typeof area === "string" && area.trim().length > 0 ? area.trim() : null;

    const caseUpsertData = {
      caseType: "CRIMINAL" as const,
      branch: normalizedBranch,
      assistantBranch: normalizedAssistantBranch,
      caseNumber,
      number: number ?? null,
      area: normalizedArea,
      year: year ?? null,
      isManual,
      dateFiled: dateFiled ?? null,
    };

    console.log("[sync:criminal] Electron received one-case sync payload.", {
      source,
      sentAt,
      caseId,
      caseNumber,
    });

    const upserted = await prisma.$transaction(async (tx) => {
      const syncedCase = await tx.case.upsert({
        where: { id: caseId },
        create: {
          id: caseId,
          ...caseUpsertData,
        },
        update: caseUpsertData,
      });

      await tx.criminalCase.upsert({
        where: { baseCaseID: caseId },
        create: {
          baseCaseID: caseId,
          ...criminalCaseUpsertData,
        },
        update: criminalCaseUpsertData,
      });

      return syncedCase;
    });

    const result: UpsertSingleCriminalCaseResult = {
      caseId: upserted.id,
      caseNumber: upserted.caseNumber,
      syncedAt: new Date().toISOString(),
    };

    console.log("[sync:criminal] Electron upsert complete.", {
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
