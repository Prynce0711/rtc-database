export type CaseBranchHistoryEventType =
  | "ORIGINAL_RAFFLE"
  | "BRANCH_UPDATE"
  | "RAFFLE_DATE_UPDATE"
  | "RERAFFLE"
  | "UNLOADED"
  | "CONSOLIDATED";

export type CaseBranchHistoryData = {
  id: number;
  baseCaseID: number;
  eventType: CaseBranchHistoryEventType | string;
  fromBranch: string | null;
  toBranch: string | null;
  raffleDate: Date | string | null;
  notes: string | null;
  source: string | null;
  fingerprint: string;
  createdAt: Date | string;
  updatedAt: Date | string | null;
};

export const CASE_BRANCH_HISTORY_LABELS: Record<
  CaseBranchHistoryEventType,
  string
> = {
  ORIGINAL_RAFFLE: "Original Raffle",
  BRANCH_UPDATE: "Branch Update",
  RAFFLE_DATE_UPDATE: "Raffle Date Update",
  RERAFFLE: "Re-Raffle",
  UNLOADED: "Unloaded",
  CONSOLIDATED: "Consolidated",
};
