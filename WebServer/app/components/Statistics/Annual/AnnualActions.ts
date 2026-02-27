"use server";

import { LogAction } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import { prettifyError } from "zod";
import ActionResult from "../../ActionResult";
import {
  BaseLogData,
  CaseSchema,
  CompleteLogData,
  CreateLogData,
  InventoryDocumentSchema,
} from "./Schema";

export async function getLogs(): Promise<ActionResult<CompleteLogData[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation; // Return the error from session validation
    }

    const logs = await prisma.log.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const parsedLogs = logs.map((log) => {
      const createData = CreateLogData.safeParse({
        action: log.action,
        details: log.details,
      });
      const baseData = BaseLogData.safeParse(log);

      if (!createData.success) {
        console.error(
          "Failed to parse log details for log ID " +
            log.id +
            ": " +
            prettifyError(createData.error),
        );
        return null; // Skip this log entry if details parsing fails
      }

      if (!baseData.success) {
        console.error(
          "Failed to parse base log data for log ID " +
            log.id +
            ": " +
            prettifyError(baseData.error),
        );
        return null; // Skip this log entry if base data parsing fails
      }

      const completeData: CompleteLogData = {
        ...baseData.data,
        ...createData.data,
      };

      return completeData;
    });

    return {
      success: true,
      result: parsedLogs.filter((log) => log !== null) as CompleteLogData[],
    };
  } catch (error) {
    console.error("Error fetching logs:", error);
    return {
      success: false,
      error: (error as Error).message || "Failed to fetch logs",
    };
  }
}

export async function createLog(
  logData: CreateLogData,
): Promise<ActionResult<void>> {
  try {
    const isLoginAttempt =
      logData.action === LogAction.LOGIN_SUCCESS ||
      logData.action === LogAction.LOGIN_FAILED;

    if (isLoginAttempt) {
      await prisma.log.create({
        data: {
          action: logData.action as unknown as LogAction,
          userId:
            logData.action === LogAction.LOGIN_SUCCESS
              ? logData.details.id
              : undefined,
          details: JSON.parse(JSON.stringify(logData.details)), // Ensure details is stored as JSON in the database
        },
      });
      return { success: true, result: undefined };
    }

    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation; // Return the error from session validation
    }

    const validation = CreateLogData.safeParse(logData);
    if (!validation.success) {
      throw new Error("Invalid log data: " + prettifyError(validation.error));
    }

    await prisma.log.create({
      data: {
        action: logData.action as unknown as LogAction,
        userId: sessionValidation.result.id,
        details: JSON.parse(JSON.stringify(logData.details)), // Ensure details is stored as JSON in the database
      },
    });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error creating log:", error);
    return { success: false, error: "Failed to create log" };
  }
}

// ─── AnnualTrialCourt (CaseSchema) ───────────────────────────────────────────

export async function getAnnualTrialCourts(): Promise<
  ActionResult<CaseSchema[]>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.annualTrialCourt.findMany();
    return {
      success: true,
      result: records.map((r) => ({
        ...r,
        pendingLastYear: r.pendingLastYear ?? undefined,
        RaffledOrAdded: r.RaffledOrAdded ?? undefined,
        Disposed: r.Disposed ?? undefined,
        pendingThisYear: r.pendingThisYear ?? undefined,
        percentageOfDisposition: r.percentageOfDisposition ?? undefined,
      })) as CaseSchema[],
    };
  } catch (error) {
    console.error("Error fetching annual trial courts:", error);
    return { success: false, error: "Failed to fetch annual trial courts" };
  }
}

export async function createAnnualTrialCourt(
  data: CaseSchema,
): Promise<ActionResult<CaseSchema>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = CaseSchema.safeParse(data);
    if (!validation.success) {
      throw new Error("Invalid data: " + prettifyError(validation.error));
    }

    const record = await prisma.annualTrialCourt.create({
      data: {
        branch: validation.data.branch,
        pendingLastYear: validation.data.pendingLastYear?.toString(),
        RaffledOrAdded: validation.data.RaffledOrAdded?.toString(),
        Disposed: validation.data.Disposed?.toString(),
        pendingThisYear: validation.data.pendingThisYear?.toString(),
        percentageOfDisposition:
          validation.data.percentageOfDisposition?.toString(),
      },
    });
    return {
      success: true,
      result: {
        ...record,
        pendingLastYear: record.pendingLastYear ?? undefined,
        RaffledOrAdded: record.RaffledOrAdded ?? undefined,
        Disposed: record.Disposed ?? undefined,
        pendingThisYear: record.pendingThisYear ?? undefined,
        percentageOfDisposition: record.percentageOfDisposition ?? undefined,
      } as CaseSchema,
    };
  } catch (error) {
    console.error("Error creating annual trial court:", error);
    return { success: false, error: "Failed to create annual trial court" };
  }
}

export async function updateAnnualTrialCourt(
  id: number,
  data: CaseSchema,
): Promise<ActionResult<CaseSchema>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = CaseSchema.safeParse(data);
    if (!validation.success) {
      throw new Error("Invalid data: " + prettifyError(validation.error));
    }

    const record = await prisma.annualTrialCourt.update({
      where: { id },
      data: {
        branch: validation.data.branch,
        pendingLastYear: validation.data.pendingLastYear?.toString(),
        RaffledOrAdded: validation.data.RaffledOrAdded?.toString(),
        Disposed: validation.data.Disposed?.toString(),
        pendingThisYear: validation.data.pendingThisYear?.toString(),
        percentageOfDisposition:
          validation.data.percentageOfDisposition?.toString(),
      },
    });
    return {
      success: true,
      result: {
        ...record,
        pendingLastYear: record.pendingLastYear ?? undefined,
        RaffledOrAdded: record.RaffledOrAdded ?? undefined,
        Disposed: record.Disposed ?? undefined,
        pendingThisYear: record.pendingThisYear ?? undefined,
        percentageOfDisposition: record.percentageOfDisposition ?? undefined,
      } as CaseSchema,
    };
  } catch (error) {
    console.error("Error updating annual trial court:", error);
    return { success: false, error: "Failed to update annual trial court" };
  }
}

export async function deleteAnnualTrialCourt(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    await prisma.annualTrialCourt.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting annual trial court:", error);
    return { success: false, error: "Failed to delete annual trial court" };
  }
}

// ─── InventoryDocument (InventoryDocumentSchema) ─────────────────────────────

export async function getInventoryDocuments(): Promise<
  ActionResult<InventoryDocumentSchema[]>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const records = await prisma.inventoryDocument.findMany();
    return {
      success: true,
      result: records.map((r) => ({
        ...r,
        civilSmallClaimsFiled: r.civilSmallClaimsFiled ?? undefined,
        criminalCasesFiled: r.criminalCasesFiled ?? undefined,
        civilSmallClaimsDisposed: r.civilSmallClaimsDisposed ?? undefined,
        criminalCasesDisposed: r.criminalCasesDisposed ?? undefined,
        dateRecorded: r.dateRecorded?.toISOString(),
      })) as InventoryDocumentSchema[],
    };
  } catch (error) {
    console.error("Error fetching inventory documents:", error);
    return { success: false, error: "Failed to fetch inventory documents" };
  }
}

export async function createInventoryDocument(
  data: InventoryDocumentSchema,
): Promise<ActionResult<InventoryDocumentSchema>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = InventoryDocumentSchema.safeParse(data);
    if (!validation.success) {
      throw new Error("Invalid data: " + prettifyError(validation.error));
    }

    const record = await prisma.inventoryDocument.create({
      data: {
        region: validation.data.region,
        province: validation.data.province,
        court: validation.data.court,
        cityMunicipality: validation.data.cityMunicipality,
        branch: validation.data.branch,
        civilSmallClaimsFiled:
          validation.data.civilSmallClaimsFiled?.toString(),
        criminalCasesFiled: validation.data.criminalCasesFiled?.toString(),
        civilSmallClaimsDisposed:
          validation.data.civilSmallClaimsDisposed?.toString(),
        criminalCasesDisposed:
          validation.data.criminalCasesDisposed?.toString(),
        dateRecorded: validation.data.dateRecorded
          ? new Date(validation.data.dateRecorded)
          : undefined,
      },
    });
    return {
      success: true,
      result: {
        ...record,
        civilSmallClaimsFiled: record.civilSmallClaimsFiled ?? undefined,
        criminalCasesFiled: record.criminalCasesFiled ?? undefined,
        civilSmallClaimsDisposed: record.civilSmallClaimsDisposed ?? undefined,
        criminalCasesDisposed: record.criminalCasesDisposed ?? undefined,
        dateRecorded: record.dateRecorded?.toISOString(),
      } as InventoryDocumentSchema,
    };
  } catch (error) {
    console.error("Error creating inventory document:", error);
    return { success: false, error: "Failed to create inventory document" };
  }
}

export async function updateInventoryDocument(
  id: number,
  data: InventoryDocumentSchema,
): Promise<ActionResult<InventoryDocumentSchema>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = InventoryDocumentSchema.safeParse(data);
    if (!validation.success) {
      throw new Error("Invalid data: " + prettifyError(validation.error));
    }

    const record = await prisma.inventoryDocument.update({
      where: { id },
      data: {
        region: validation.data.region,
        province: validation.data.province,
        court: validation.data.court,
        cityMunicipality: validation.data.cityMunicipality,
        branch: validation.data.branch,
        civilSmallClaimsFiled:
          validation.data.civilSmallClaimsFiled?.toString(),
        criminalCasesFiled: validation.data.criminalCasesFiled?.toString(),
        civilSmallClaimsDisposed:
          validation.data.civilSmallClaimsDisposed?.toString(),
        criminalCasesDisposed:
          validation.data.criminalCasesDisposed?.toString(),
        dateRecorded: validation.data.dateRecorded
          ? new Date(validation.data.dateRecorded)
          : undefined,
      },
    });
    return {
      success: true,
      result: {
        ...record,
        civilSmallClaimsFiled: record.civilSmallClaimsFiled ?? undefined,
        criminalCasesFiled: record.criminalCasesFiled ?? undefined,
        civilSmallClaimsDisposed: record.civilSmallClaimsDisposed ?? undefined,
        criminalCasesDisposed: record.criminalCasesDisposed ?? undefined,
        dateRecorded: record.dateRecorded?.toISOString(),
      } as InventoryDocumentSchema,
    };
  } catch (error) {
    console.error("Error updating inventory document:", error);
    return { success: false, error: "Failed to update inventory document" };
  }
}

export async function deleteInventoryDocument(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    await prisma.inventoryDocument.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting inventory document:", error);
    return { success: false, error: "Failed to delete inventory document" };
  }
}
