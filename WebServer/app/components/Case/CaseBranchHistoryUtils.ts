import type { CaseBranchHistoryEventType } from "@rtc-database/shared";
import type { Prisma } from "@rtc-database/shared/prisma/client";

type BranchHistoryClient = Pick<Prisma.TransactionClient, "caseBranchHistory">;

type BranchHistoryInput = {
  caseId: number;
  eventType: CaseBranchHistoryEventType;
  fromBranch?: string | null;
  toBranch?: string | null;
  raffleDate?: unknown;
  notes?: string | null;
  source?: string | null;
};

type BranchChangeInput = {
  caseId: number;
  previousBranch?: string | null;
  nextBranch?: string | null;
  originalRaffleDate?: unknown;
  previousRaffleDate?: unknown;
  nextRaffleDate?: unknown;
  source?: string | null;
};

export const normalizeBranchForHistory = (
  value: string | null | undefined,
): string | null => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a") return null;
  return trimmed;
};

export const asHistoryDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKey = (value: Date | null): string =>
  value ? value.toISOString().slice(0, 10) : "";

const makeFingerprint = ({
  caseId,
  eventType,
  fromBranch,
  toBranch,
  raffleDate,
}: {
  caseId: number;
  eventType: CaseBranchHistoryEventType;
  fromBranch: string | null;
  toBranch: string | null;
  raffleDate: Date | null;
}) =>
  [
    caseId,
    eventType,
    fromBranch ?? "",
    toBranch ?? "",
    dateKey(raffleDate),
  ].join("|");

export async function recordCaseBranchHistory(
  client: BranchHistoryClient,
  input: BranchHistoryInput,
) {
  const fromBranch = normalizeBranchForHistory(input.fromBranch);
  const toBranch = normalizeBranchForHistory(input.toBranch);
  const raffleDate = asHistoryDate(input.raffleDate);

  if (!fromBranch && !toBranch && !raffleDate) return;

  const source = input.source ?? "unknown";
  const notes = input.notes ?? null;
  const fingerprint = makeFingerprint({
    caseId: input.caseId,
    eventType: input.eventType,
    fromBranch,
    toBranch,
    raffleDate,
  });
  const updateData: Prisma.CaseBranchHistoryUpdateInput =
    source === "backfill" || source === "legacy" ? {} : { notes, source };

  await client.caseBranchHistory.upsert({
    where: { fingerprint },
    create: {
      baseCaseID: input.caseId,
      eventType: input.eventType,
      fromBranch,
      toBranch,
      raffleDate,
      notes,
      source,
      fingerprint,
    },
    update: updateData,
  });
}

export async function recordInitialCaseBranchHistory(
  client: BranchHistoryClient,
  input: {
    caseId: number;
    branch?: string | null;
    raffleDate?: unknown;
    source?: string | null;
  },
) {
  await recordCaseBranchHistory(client, {
    caseId: input.caseId,
    eventType: "ORIGINAL_RAFFLE",
    fromBranch: null,
    toBranch: input.branch,
    raffleDate: input.raffleDate,
    source: input.source,
  });
}

export async function recordCaseBranchChange(
  client: BranchHistoryClient,
  input: BranchChangeInput,
) {
  const originalRaffleDate =
    asHistoryDate(input.originalRaffleDate) ??
    asHistoryDate(input.previousRaffleDate) ??
    asHistoryDate(input.nextRaffleDate);

  await recordInitialCaseBranchHistory(client, {
    caseId: input.caseId,
    branch: input.previousBranch,
    raffleDate: originalRaffleDate,
    source: input.source,
  });

  const fromBranch = normalizeBranchForHistory(input.previousBranch);
  const toBranch = normalizeBranchForHistory(input.nextBranch);
  const previousRaffleDate =
    asHistoryDate(input.previousRaffleDate) ?? originalRaffleDate;
  const nextRaffleDate = asHistoryDate(input.nextRaffleDate) ?? previousRaffleDate;
  const branchChanged = fromBranch !== toBranch;
  const dateChanged = dateKey(previousRaffleDate) !== dateKey(nextRaffleDate);

  if (!branchChanged && !dateChanged) return;

  const eventType: CaseBranchHistoryEventType =
    fromBranch && !toBranch
      ? "UNLOADED"
      : branchChanged && dateChanged
        ? "RERAFFLE"
        : branchChanged
          ? "BRANCH_UPDATE"
          : "RAFFLE_DATE_UPDATE";

  await recordCaseBranchHistory(client, {
    caseId: input.caseId,
    eventType,
    fromBranch,
    toBranch,
    raffleDate: nextRaffleDate,
    source: input.source,
  });
}
