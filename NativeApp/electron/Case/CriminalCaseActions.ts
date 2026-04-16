import type {
  UpsertSingleCriminalCaseResponse,
  UpsertSingleCriminalCaseResult,
} from "@rtc-database/shared/src/lib/sync";
import { prisma } from "../prisma";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sanitizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeOptionalInteger = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value;
};

const sanitizeOptionalDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const payloadError = (error: string): UpsertSingleCriminalCaseResponse => ({
  success: false,
  error,
});

export const upsertSingleCriminalCase = async (
  payload: unknown,
): Promise<UpsertSingleCriminalCaseResponse> => {
  try {
    if (!isRecord(payload)) {
      return payloadError("Payload must be an object.");
    }

    const source =
      typeof payload.source === "string" && payload.source.length > 0
        ? payload.source
        : "unknown";
    const sentAt =
      typeof payload.sentAt === "string" && payload.sentAt.length > 0
        ? payload.sentAt
        : null;

    if (!isRecord(payload.caseData)) {
      return payloadError("Payload.caseData must be an object.");
    }

    const rawCaseData = payload.caseData;
    const caseId = Number(rawCaseData.id);

    if (!Number.isInteger(caseId) || caseId <= 0) {
      return payloadError("Payload.caseData.id must be a positive integer.");
    }

    const caseType = sanitizeOptionalString(rawCaseData.caseType);
    if (caseType !== "CRIMINAL") {
      return payloadError(
        "Only CRIMINAL cases can be synced through this test channel.",
      );
    }

    const caseNumber = sanitizeOptionalString(rawCaseData.caseNumber);
    if (!caseNumber) {
      return payloadError("Payload.caseData.caseNumber is required.");
    }

    const name = sanitizeOptionalString(rawCaseData.name);
    if (!name) {
      return payloadError("Payload.caseData.name is required.");
    }

    const normalizedCaseData = {
      branch: sanitizeOptionalString(rawCaseData.branch),
      assistantBranch: sanitizeOptionalString(rawCaseData.assistantBranch),
      dateFiled: sanitizeOptionalDate(rawCaseData.dateFiled),
      name,
      charge: sanitizeOptionalString(rawCaseData.charge),
      infoSheet: sanitizeOptionalString(rawCaseData.infoSheet),
      court: sanitizeOptionalString(rawCaseData.court),
      detained: sanitizeOptionalString(rawCaseData.detained),
      consolidation: sanitizeOptionalString(rawCaseData.consolidation),
      eqcNumber: sanitizeOptionalString(rawCaseData.eqcNumber),
      bond: sanitizeOptionalString(rawCaseData.bond),
      raffleDate: sanitizeOptionalDate(rawCaseData.raffleDate),
      committee1: sanitizeOptionalString(rawCaseData.committee1),
      committee2: sanitizeOptionalString(rawCaseData.committee2),
      judge: sanitizeOptionalString(rawCaseData.judge),
      ao: sanitizeOptionalString(rawCaseData.ao),
      complainant: sanitizeOptionalString(rawCaseData.complainant),
      houseNo: sanitizeOptionalString(rawCaseData.houseNo),
      street: sanitizeOptionalString(rawCaseData.street),
      barangay: sanitizeOptionalString(rawCaseData.barangay),
      municipality: sanitizeOptionalString(rawCaseData.municipality),
      province: sanitizeOptionalString(rawCaseData.province),
      counts: sanitizeOptionalString(rawCaseData.counts),
      jdf: sanitizeOptionalString(rawCaseData.jdf),
      sajj: sanitizeOptionalString(rawCaseData.sajj),
      sajj2: sanitizeOptionalString(rawCaseData.sajj2),
      mf: sanitizeOptionalString(rawCaseData.mf),
      stf: sanitizeOptionalString(rawCaseData.stf),
      lrf: sanitizeOptionalString(rawCaseData.lrf),
      vcf: sanitizeOptionalString(rawCaseData.vcf),
      total: sanitizeOptionalString(rawCaseData.total),
      amountInvolved: sanitizeOptionalString(rawCaseData.amountInvolved),
    };

    const caseNumberParts = {
      number: sanitizeOptionalInteger(rawCaseData.number),
      area: sanitizeOptionalString(rawCaseData.area),
      year: sanitizeOptionalInteger(rawCaseData.year),
      isManual:
        typeof rawCaseData.isManual === "boolean"
          ? rawCaseData.isManual
          : false,
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
          caseType: "CRIMINAL",
          branch: normalizedCaseData.branch,
          assistantBranch: normalizedCaseData.assistantBranch,
          caseNumber,
          number: caseNumberParts.number,
          area: caseNumberParts.area,
          year: caseNumberParts.year,
          isManual: caseNumberParts.isManual,
          dateFiled: normalizedCaseData.dateFiled,
        },
        update: {
          caseType: "CRIMINAL",
          branch: normalizedCaseData.branch,
          assistantBranch: normalizedCaseData.assistantBranch,
          caseNumber,
          number: caseNumberParts.number,
          area: caseNumberParts.area,
          year: caseNumberParts.year,
          isManual: caseNumberParts.isManual,
          dateFiled: normalizedCaseData.dateFiled,
        },
      });

      await tx.criminalCase.upsert({
        where: { baseCaseID: caseId },
        create: {
          baseCaseID: caseId,
          name: normalizedCaseData.name,
          charge: normalizedCaseData.charge,
          infoSheet: normalizedCaseData.infoSheet,
          court: normalizedCaseData.court,
          detained: normalizedCaseData.detained,
          consolidation: normalizedCaseData.consolidation,
          eqcNumber: normalizedCaseData.eqcNumber,
          bond: normalizedCaseData.bond,
          raffleDate: normalizedCaseData.raffleDate,
          committee1: normalizedCaseData.committee1,
          committee2: normalizedCaseData.committee2,
          judge: normalizedCaseData.judge,
          ao: normalizedCaseData.ao,
          complainant: normalizedCaseData.complainant,
          houseNo: normalizedCaseData.houseNo,
          street: normalizedCaseData.street,
          barangay: normalizedCaseData.barangay,
          municipality: normalizedCaseData.municipality,
          province: normalizedCaseData.province,
          counts: normalizedCaseData.counts,
          jdf: normalizedCaseData.jdf,
          sajj: normalizedCaseData.sajj,
          sajj2: normalizedCaseData.sajj2,
          mf: normalizedCaseData.mf,
          stf: normalizedCaseData.stf,
          lrf: normalizedCaseData.lrf,
          vcf: normalizedCaseData.vcf,
          total: normalizedCaseData.total,
          amountInvolved: normalizedCaseData.amountInvolved,
        },
        update: {
          name: normalizedCaseData.name,
          charge: normalizedCaseData.charge,
          infoSheet: normalizedCaseData.infoSheet,
          court: normalizedCaseData.court,
          detained: normalizedCaseData.detained,
          consolidation: normalizedCaseData.consolidation,
          eqcNumber: normalizedCaseData.eqcNumber,
          bond: normalizedCaseData.bond,
          raffleDate: normalizedCaseData.raffleDate,
          committee1: normalizedCaseData.committee1,
          committee2: normalizedCaseData.committee2,
          judge: normalizedCaseData.judge,
          ao: normalizedCaseData.ao,
          complainant: normalizedCaseData.complainant,
          houseNo: normalizedCaseData.houseNo,
          street: normalizedCaseData.street,
          barangay: normalizedCaseData.barangay,
          municipality: normalizedCaseData.municipality,
          province: normalizedCaseData.province,
          counts: normalizedCaseData.counts,
          jdf: normalizedCaseData.jdf,
          sajj: normalizedCaseData.sajj,
          sajj2: normalizedCaseData.sajj2,
          mf: normalizedCaseData.mf,
          stf: normalizedCaseData.stf,
          lrf: normalizedCaseData.lrf,
          vcf: normalizedCaseData.vcf,
          total: normalizedCaseData.total,
          amountInvolved: normalizedCaseData.amountInvolved,
        },
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
