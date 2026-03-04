"use server";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
// zod doesn't export a `prettifyError` helper in all versions — provide a small local formatter
import ActionResult from "../../ActionResult";
import {
  MTCJudgementRow,
  MTCJudgementRowSchema,
  RTCJudgementRow,
  RTCJudgementRowSchema,
} from "./Schema";

const toNumber = (v: unknown) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? (v as number) : 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
};

const prettifyError = (err: unknown) => {
  try {
    // ZodError has `format` and `issues`; try to produce a readable message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e: any = err;
    if (e?.issues) return JSON.stringify(e.issues, null, 2);
    if (e?.message) return String(e.message);
    return String(err);
  } catch (e) {
    return String(err);
  }
};

// Municipal (MTC)
export async function getMunicipalJudgements(): Promise<
  ActionResult<MTCJudgementRow[]>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const rows = await prisma.judgementMunicipal.findMany();
    return {
      success: true,
      result: rows.map((r) => ({
        id: r.id,
        branchNo: r.branchNo ?? undefined,
        civilV: r.civilV,
        civilInC: r.civilInc,
        criminalV: r.criminalV,
        criminalInC: r.criminalInc,
        totalHeard: r.totalHeard,
        disposedCivil: r.disposedCivil,
        disposedCrim: r.disposedCrim,
        totalDisposed: r.totalDisposed,
        pdlM: r.pdlM,
        pdlF: r.pdlF,
        pdlTotal: r.pdlTotal,
        pdlV: r.pdlV,
        pdlI: r.pdlI,
        pdlBail: r.pdlBail,
        pdlRecognizance: r.pdlRecognizance,
        pdlMinRor: r.pdlMinRor,
        pdlMaxSentence: r.pdlMaxSentence,
        pdlDismissal: r.pdlDismissal,
        pdlAcquittal: r.pdlAcquittal,
        pdlMinSentence: r.pdlMinSentence,
        pdlOthers: r.pdlOthers,
        total: r.total,
      })) as MTCJudgementRow[],
    };
  } catch (error) {
    console.error("Error fetching municipal judgements:", error);
    return { success: false, error: "Failed to fetch municipal judgements" };
  }
}

export async function createMunicipalJudgement(
  data: MTCJudgementRow,
): Promise<ActionResult<MTCJudgementRow>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = MTCJudgementRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const record = await prisma.judgementMunicipal.create({
      data: {
        branchNo: validation.data.branchNo ?? undefined,
        civilV: toNumber(validation.data.civilV),
        civilInc: toNumber(validation.data.civilInC),
        criminalV: toNumber(validation.data.criminalV),
        criminalInc: toNumber(validation.data.criminalInC),
        totalHeard: toNumber(validation.data.totalHeard) || 0,
        disposedCivil: toNumber(validation.data.disposedCivil) || 0,
        disposedCrim: toNumber(validation.data.disposedCrim) || 0,
        totalDisposed: toNumber(validation.data.totalDisposed) || 0,
        pdlM: toNumber(validation.data.pdlM) || 0,
        pdlF: toNumber(validation.data.pdlF) || 0,
        pdlTotal: toNumber(validation.data.pdlTotal) || 0,
        pdlV: toNumber(validation.data.pdlV) || 0,
        pdlI: toNumber(validation.data.pdlI) || 0,
        pdlBail: toNumber(validation.data.pdlBail) || 0,
        pdlRecognizance: toNumber(validation.data.pdlRecognizance) || 0,
        pdlMinRor: toNumber(validation.data.pdlMinRor) || 0,
        pdlMaxSentence: toNumber(validation.data.pdlMaxSentence) || 0,
        pdlDismissal: toNumber(validation.data.pdlDismissal) || 0,
        pdlAcquittal: toNumber(validation.data.pdlAcquittal) || 0,
        pdlMinSentence: toNumber(validation.data.pdlMinSentence) || 0,
        pdlOthers: toNumber(validation.data.pdlOthers) || 0,
        total: toNumber(validation.data.total) || 0,
      },
    });

    return {
      success: true,
      result: {
        id: record.id,
        branchNo: record.branchNo ?? undefined,
        civilV: record.civilV,
        civilInC: record.civilInc,
        criminalV: record.criminalV,
        criminalInC: record.criminalInc,
        totalHeard: record.totalHeard,
        disposedCivil: record.disposedCivil,
        disposedCrim: record.disposedCrim,
        totalDisposed: record.totalDisposed,
        pdlM: record.pdlM,
        pdlF: record.pdlF,
        pdlTotal: record.pdlTotal,
        pdlV: record.pdlV,
        pdlI: record.pdlI,
        pdlBail: record.pdlBail,
        pdlRecognizance: record.pdlRecognizance,
        pdlMinRor: record.pdlMinRor,
        pdlMaxSentence: record.pdlMaxSentence,
        pdlDismissal: record.pdlDismissal,
        pdlAcquittal: record.pdlAcquittal,
        pdlMinSentence: record.pdlMinSentence,
        pdlOthers: record.pdlOthers,
        total: record.total,
      } as MTCJudgementRow,
    };
  } catch (error) {
    console.error("Error creating municipal judgement:", error);
    return { success: false, error: "Failed to create municipal judgement" };
  }
}

export async function updateMunicipalJudgement(
  id: number,
  data: MTCJudgementRow,
): Promise<ActionResult<MTCJudgementRow>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = MTCJudgementRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const record = await prisma.judgementMunicipal.update({
      where: { id },
      data: {
        branchNo: validation.data.branchNo ?? undefined,
        civilV: toNumber(validation.data.civilV),
        civilInc: toNumber(validation.data.civilInC),
        criminalV: toNumber(validation.data.criminalV),
        criminalInc: toNumber(validation.data.criminalInC),
        totalHeard: toNumber(validation.data.totalHeard) || 0,
        disposedCivil: toNumber(validation.data.disposedCivil) || 0,
        disposedCrim: toNumber(validation.data.disposedCrim) || 0,
        totalDisposed: toNumber(validation.data.totalDisposed) || 0,
        pdlM: toNumber(validation.data.pdlM) || 0,
        pdlF: toNumber(validation.data.pdlF) || 0,
        pdlTotal: toNumber(validation.data.pdlTotal) || 0,
        pdlV: toNumber(validation.data.pdlV) || 0,
        pdlI: toNumber(validation.data.pdlI) || 0,
        pdlBail: toNumber(validation.data.pdlBail) || 0,
        pdlRecognizance: toNumber(validation.data.pdlRecognizance) || 0,
        pdlMinRor: toNumber(validation.data.pdlMinRor) || 0,
        pdlMaxSentence: toNumber(validation.data.pdlMaxSentence) || 0,
        pdlDismissal: toNumber(validation.data.pdlDismissal) || 0,
        pdlAcquittal: toNumber(validation.data.pdlAcquittal) || 0,
        pdlMinSentence: toNumber(validation.data.pdlMinSentence) || 0,
        pdlOthers: toNumber(validation.data.pdlOthers) || 0,
        total: toNumber(validation.data.total) || 0,
      },
    });

    return {
      success: true,
      result: {
        id: record.id,
        branchNo: record.branchNo ?? undefined,
        civilV: record.civilV,
        civilInC: record.civilInc,
        criminalV: record.criminalV,
        criminalInC: record.criminalInc,
        totalHeard: record.totalHeard,
        disposedCivil: record.disposedCivil,
        disposedCrim: record.disposedCrim,
        totalDisposed: record.totalDisposed,
        pdlM: record.pdlM,
        pdlF: record.pdlF,
        pdlTotal: record.pdlTotal,
        pdlV: record.pdlV,
        pdlI: record.pdlI,
        pdlBail: record.pdlBail,
        pdlRecognizance: record.pdlRecognizance,
        pdlMinRor: record.pdlMinRor,
        pdlMaxSentence: record.pdlMaxSentence,
        pdlDismissal: record.pdlDismissal,
        pdlAcquittal: record.pdlAcquittal,
        pdlMinSentence: record.pdlMinSentence,
        pdlOthers: record.pdlOthers,
        total: record.total,
      } as MTCJudgementRow,
    };
  } catch (error) {
    console.error("Error updating municipal judgement:", error);
    return { success: false, error: "Failed to update municipal judgement" };
  }
}

export async function deleteMunicipalJudgement(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    await prisma.judgementMunicipal.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting municipal judgement:", error);
    return { success: false, error: "Failed to delete municipal judgement" };
  }
}

// Regional (RTC)
export async function getRegionalJudgements(): Promise<
  ActionResult<RTCJudgementRow[]>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const rows = await prisma.judgementRegional.findMany();
    return {
      success: true,
      result: rows.map((r) => ({
        id: r.id,
        branchNo: r.branchNo ?? undefined,
        civilV: r.civilV,
        civilInC: r.civilInc,
        criminalV: r.criminalV,
        criminalInC: r.criminalInc,
        totalHeard: r.totalHeard,
        disposedCivil: r.disposedCivil,
        disposedCrim: r.disposedCrim,
        summaryProc: r.summaryProc,
        casesDisposed: r.casesDisposed,
        pdlM: r.pdlM,
        pdlF: r.pdlF,
        pdlCICL: r.pdlCICL,
        pdlTotal: r.pdlTotal,
        pdlV: r.pdlV,
        pdlInC: r.pdlInc,
        pdlBail: r.pdlBail,
        pdlRecognizance: r.pdlRecognizance,
        pdlMinRor: r.pdlMinRor,
        pdlMaxSentence: r.pdlMaxSentence,
        pdlDismissal: r.pdlDismissal,
        pdlAcquittal: r.pdlAcquittal,
        pdlMinSentence: r.pdlMinSentence,
        pdlProbation: r.pdlProbation,
        ciclM: r.ciclM,
        ciclF: r.ciclF,
        ciclV: r.ciclV,
        ciclInC: r.ciclInc,
        fine: r.fine,
        total: r.total,
      })) as RTCJudgementRow[],
    };
  } catch (error) {
    console.error("Error fetching regional judgements:", error);
    return { success: false, error: "Failed to fetch regional judgements" };
  }
}

export async function createRegionalJudgement(
  data: RTCJudgementRow,
): Promise<ActionResult<RTCJudgementRow>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = RTCJudgementRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const record = await prisma.judgementRegional.create({
      data: {
        branchNo: validation.data.branchNo ?? undefined,
        civilV: toNumber(validation.data.civilV),
        civilInc: toNumber(validation.data.civilInC),
        criminalV: toNumber(validation.data.criminalV),
        criminalInc: toNumber(validation.data.criminalInC),
        totalHeard: toNumber(validation.data.totalHeard) || 0,
        disposedCivil: toNumber(validation.data.disposedCivil) || 0,
        disposedCrim: toNumber(validation.data.disposedCrim) || 0,
        summaryProc: toNumber(validation.data.summaryProc) || 0,
        casesDisposed: toNumber(validation.data.casesDisposed) || 0,
        pdlM: toNumber(validation.data.pdlM) || 0,
        pdlF: toNumber(validation.data.pdlF) || 0,
        pdlCICL: toNumber(validation.data.pdlCICL) || 0,
        pdlTotal: toNumber(validation.data.pdlTotal) || 0,
        pdlV: toNumber(validation.data.pdlV) || 0,
        pdlInc: toNumber(validation.data.pdlInC) || 0,
        pdlBail: toNumber(validation.data.pdlBail) || 0,
        pdlRecognizance: toNumber(validation.data.pdlRecognizance) || 0,
        pdlMinRor: toNumber(validation.data.pdlMinRor) || 0,
        pdlMaxSentence: toNumber(validation.data.pdlMaxSentence) || 0,
        pdlDismissal: toNumber(validation.data.pdlDismissal) || 0,
        pdlAcquittal: toNumber(validation.data.pdlAcquittal) || 0,
        pdlMinSentence: toNumber(validation.data.pdlMinSentence) || 0,
        pdlProbation: toNumber(validation.data.pdlProbation) || 0,
        ciclM: toNumber(validation.data.ciclM) || 0,
        ciclF: toNumber(validation.data.ciclF) || 0,
        ciclV: toNumber(validation.data.ciclV) || 0,
        ciclInc: toNumber(validation.data.ciclInC) || 0,
        fine: toNumber(validation.data.fine) || 0,
        total: toNumber(validation.data.total) || 0,
      },
    });

    return {
      success: true,
      result: {
        id: record.id,
        branchNo: record.branchNo ?? undefined,
        civilV: record.civilV,
        civilInC: record.civilInc,
        criminalV: record.criminalV,
        criminalInC: record.criminalInc,
        totalHeard: record.totalHeard,
        disposedCivil: record.disposedCivil,
        disposedCrim: record.disposedCrim,
        summaryProc: record.summaryProc,
        casesDisposed: record.casesDisposed,
        pdlM: record.pdlM,
        pdlF: record.pdlF,
        pdlCICL: record.pdlCICL,
        pdlTotal: record.pdlTotal,
        pdlV: record.pdlV,
        pdlInC: record.pdlInc,
        pdlBail: record.pdlBail,
        pdlRecognizance: record.pdlRecognizance,
        pdlMinRor: record.pdlMinRor,
        pdlMaxSentence: record.pdlMaxSentence,
        pdlDismissal: record.pdlDismissal,
        pdlAcquittal: record.pdlAcquittal,
        pdlMinSentence: record.pdlMinSentence,
        pdlProbation: record.pdlProbation,
        ciclM: record.ciclM,
        ciclF: record.ciclF,
        ciclV: record.ciclV,
        ciclInC: record.ciclInc,
        fine: record.fine,
        total: record.total,
      } as RTCJudgementRow,
    };
  } catch (error) {
    console.error("Error creating regional judgement:", error);
    return { success: false, error: "Failed to create regional judgement" };
  }
}

export async function updateRegionalJudgement(
  id: number,
  data: RTCJudgementRow,
): Promise<ActionResult<RTCJudgementRow>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    const validation = RTCJudgementRowSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: prettifyError(validation.error) };
    }

    const record = await prisma.judgementRegional.update({
      where: { id },
      data: {
        branchNo: validation.data.branchNo ?? undefined,
        civilV: toNumber(validation.data.civilV),
        civilInc: toNumber(validation.data.civilInC),
        criminalV: toNumber(validation.data.criminalV),
        criminalInc: toNumber(validation.data.criminalInC),
        totalHeard: toNumber(validation.data.totalHeard) || 0,
        disposedCivil: toNumber(validation.data.disposedCivil) || 0,
        disposedCrim: toNumber(validation.data.disposedCrim) || 0,
        summaryProc: toNumber(validation.data.summaryProc) || 0,
        casesDisposed: toNumber(validation.data.casesDisposed) || 0,
        pdlM: toNumber(validation.data.pdlM) || 0,
        pdlF: toNumber(validation.data.pdlF) || 0,
        pdlCICL: toNumber(validation.data.pdlCICL) || 0,
        pdlTotal: toNumber(validation.data.pdlTotal) || 0,
        pdlV: toNumber(validation.data.pdlV) || 0,
        pdlInc: toNumber(validation.data.pdlInC) || 0,
        pdlBail: toNumber(validation.data.pdlBail) || 0,
        pdlRecognizance: toNumber(validation.data.pdlRecognizance) || 0,
        pdlMinRor: toNumber(validation.data.pdlMinRor) || 0,
        pdlMaxSentence: toNumber(validation.data.pdlMaxSentence) || 0,
        pdlDismissal: toNumber(validation.data.pdlDismissal) || 0,
        pdlAcquittal: toNumber(validation.data.pdlAcquittal) || 0,
        pdlMinSentence: toNumber(validation.data.pdlMinSentence) || 0,
        pdlProbation: toNumber(validation.data.pdlProbation) || 0,
        ciclM: toNumber(validation.data.ciclM) || 0,
        ciclF: toNumber(validation.data.ciclF) || 0,
        ciclV: toNumber(validation.data.ciclV) || 0,
        ciclInc: toNumber(validation.data.ciclInC) || 0,
        fine: toNumber(validation.data.fine) || 0,
        total: toNumber(validation.data.total) || 0,
      },
    });

    return {
      success: true,
      result: {
        id: record.id,
        branchNo: record.branchNo ?? undefined,
        civilV: record.civilV,
        civilInC: record.civilInc,
        criminalV: record.criminalV,
        criminalInC: record.criminalInc,
        totalHeard: record.totalHeard,
        disposedCivil: record.disposedCivil,
        disposedCrim: record.disposedCrim,
        summaryProc: record.summaryProc,
        casesDisposed: record.casesDisposed,
        pdlM: record.pdlM,
        pdlF: record.pdlF,
        pdlCICL: record.pdlCICL,
        pdlTotal: record.pdlTotal,
        pdlV: record.pdlV,
        pdlInC: record.pdlInc,
        pdlBail: record.pdlBail,
        pdlRecognizance: record.pdlRecognizance,
        pdlMinRor: record.pdlMinRor,
        pdlMaxSentence: record.pdlMaxSentence,
        pdlDismissal: record.pdlDismissal,
        pdlAcquittal: record.pdlAcquittal,
        pdlMinSentence: record.pdlMinSentence,
        pdlProbation: record.pdlProbation,
        ciclM: record.ciclM,
        ciclF: record.ciclF,
        ciclV: record.ciclV,
        ciclInC: record.ciclInc,
        fine: record.fine,
        total: record.total,
      } as RTCJudgementRow,
    };
  } catch (error) {
    console.error("Error updating regional judgement:", error);
    return { success: false, error: "Failed to update regional judgement" };
  }
}

export async function deleteRegionalJudgement(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) return sessionValidation;

    await prisma.judgementRegional.delete({ where: { id } });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting regional judgement:", error);
    return { success: false, error: "Failed to delete regional judgement" };
  }
}
