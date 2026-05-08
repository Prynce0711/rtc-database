"use client";

import type { CaseBranchHistoryData } from "./CaseBranchHistory";
import { CASE_BRANCH_HISTORY_LABELS } from "./CaseBranchHistory";
import { DetailSection, formatLongDate } from "./CaseDetailsShared";

const branchText = (value: string | null | undefined) => {
  const trimmed = String(value ?? "").trim();
  return trimmed || "Unassigned";
};

const eventLabel = (value: string) =>
  CASE_BRANCH_HISTORY_LABELS[
    value as keyof typeof CASE_BRANCH_HISTORY_LABELS
  ] ?? value.replaceAll("_", " ").toLowerCase();

export default function CaseBranchHistoryTimeline({
  history,
}: {
  history: CaseBranchHistoryData[];
}) {
  return (
    <DetailSection label="Branch History">
      {history.length === 0 ? (
        <div className="rounded-xl border border-base-200 bg-base-200/40 px-5 py-4 text-[13px] font-semibold text-base-content/35">
          No branch movement recorded.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-base-200 bg-base-100 px-5 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary/70">
                    {eventLabel(entry.eventType)}
                  </p>
                  <p className="text-[15px] font-semibold text-base-content">
                    {branchText(entry.fromBranch)} to{" "}
                    {branchText(entry.toBranch)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30">
                    Raffle Date
                  </p>
                  <p className="text-[13px] font-semibold text-base-content/60">
                    {formatLongDate(entry.raffleDate)}
                  </p>
                </div>
              </div>
              {(entry.notes || entry.source) && (
                <p className="mt-3 text-[12px] font-medium text-base-content/40">
                  {[entry.notes, entry.source ? `Source: ${entry.source}` : null]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </DetailSection>
  );
}
