"use client";

import {
  DetailField,
  DetailSection,
  formatLongDate,
} from "../CaseDetailsShared";
import type { RecievingLog } from "../../generated/prisma/browser";
import type { RecievingLogsAdapter } from "./RecievingLogsAdapter";
import NavButton from "../NavButton";
import { PageDetailSkeleton } from "../../Skeleton/SkeletonTable";
import { useEffect, useState } from "react";
import { useAdaptivePathname, useAdaptiveRouter } from "../../lib/nextCompat";

const getReceivingIdFromPathname = (pathname: string): number | null => {
  const segments = pathname.split("/").filter(Boolean);
  const rawId = segments[segments.length - 1];
  const numId = Number(rawId);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
};

export default function ReceivingDetailsPage({
  adapter,
}: {
  adapter: RecievingLogsAdapter;
}) {
  const router = useAdaptiveRouter();
  const listPath = "/user/cases/receiving";
  const pathname = useAdaptivePathname();
  const returnPage =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("page")
      : null;

  const [logData, setLogData] = useState<RecievingLog | null>(null);
  const [prevLog, setPrevLog] = useState<RecievingLog | null>(null);
  const [nextLog, setNextLog] = useState<RecievingLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLog = async () => {
      try {
        setLoading(true);
        const numId = getReceivingIdFromPathname(pathname);
        if (numId === null) {
          setLogData(null);
          setPrevLog(null);
          setNextLog(null);
          return;
        }

        const [current, prev, next] = await Promise.allSettled([
          adapter.getRecievingLogById(numId),
          adapter.getRecievingLogById(numId - 1),
          adapter.getRecievingLogById(numId + 1),
        ]);

        if (current.status === "fulfilled" && current.value.success) {
          setLogData(current.value.result);
        } else {
          setLogData(null);
        }

        if (prev.status === "fulfilled" && prev.value.success) {
          setPrevLog(prev.value.result);
        } else {
          setPrevLog(null);
        }

        if (next.status === "fulfilled" && next.value.success) {
          setNextLog(next.value.result);
        } else {
          setNextLog(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (pathname) fetchLog();
  }, [pathname, adapter]);

  if (loading) return <PageDetailSkeleton />;

  if (!logData) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            Receiving log not found
          </p>
          <button
            onClick={() =>
              router.push(
                returnPage ? `${listPath}?page=${encodeURIComponent(returnPage)}` : listPath,
              )
            }
            className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity underline underline-offset-4"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const currentId = getReceivingIdFromPathname(pathname);

  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() =>
              router.push(
                returnPage ? `${listPath}?page=${encodeURIComponent(returnPage)}` : listPath,
              )
            }
            className="flex items-center gap-2 text-[13px] font-semibold text-base-content/40 hover:text-base-content transition-colors duration-150 shrink-0"
          >
            Back
          </button>

          <div className="flex items-center gap-2 text-[12px] font-semibold text-base-content/30 select-none">
            <span>Receiving Logs</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55 font-bold">
              #{logData.id}
            </span>
          </div>

          <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-2 select-none min-w-9 text-center">
            #{currentId ?? "-"}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-14 space-y-10">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/55">
            Receiving Record
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {logData.caseNumber || `#${logData.id}`}
          </h1>
          <p className="text-[15px] text-base-content/45 font-medium">
            Received {formatLongDate(logData.dateRecieved)}
          </p>
        </div>

        <div className="h-px bg-base-200" />

        <DetailSection label="Receiving Details">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <DetailField label="Book and Page" value={logData.bookAndPage} />
            <DetailField label="Case Type" value={logData.caseType} />
            <DetailField label="Case Number" value={logData.caseNumber} />
            <DetailField label="Content" value={logData.content} />
            <DetailField label="Branch Number" value={logData.branchNumber} />
            <DetailField
              label="Date Received"
              value={formatLongDate(logData.dateRecieved)}
            />
            <div className="md:col-span-2 lg:col-span-3">
              <DetailField label="Notes" value={logData.notes} />
            </div>
          </div>
        </DetailSection>

        <div className="h-px bg-base-200" />
        <div className="flex items-stretch justify-between gap-3">
          <NavButton
            direction="prev"
            label={prevLog?.caseNumber ?? "-"}
            sublabel={prevLog?.caseType ?? undefined}
            onClick={() =>
              prevLog &&
              router.push(
                `/user/cases/receiving/${prevLog.id}${returnPage ? `?page=${encodeURIComponent(returnPage)}` : ""}`,
              )
            }
            disabled={!prevLog}
          />
          <NavButton
            direction="next"
            label={nextLog?.caseNumber ?? "-"}
            sublabel={nextLog?.caseType ?? undefined}
            onClick={() =>
              nextLog &&
              router.push(
                `/user/cases/receiving/${nextLog.id}${returnPage ? `?page=${encodeURIComponent(returnPage)}` : ""}`,
              )
            }
            disabled={!nextLog}
          />
        </div>
      </main>
    </div>
  );
}

