"use client";

import {
  DetailField,
  DetailSection,
  formatLongDate,
  NavButton,
  PageDetailSkeleton,
  SheriffCaseData,
  SherriffCaseAdapter,
} from "@rtc-database/shared";
import { useEffect, useState } from "react";
import { useAdaptivePathname, useAdaptiveRouter } from "../../lib/nextCompat";

const getSheriffIdFromPathname = (pathname: string): number | null => {
  const segments = pathname.split("/").filter(Boolean);
  const rawId = segments[segments.length - 1];
  const numId = Number(rawId);
  return Number.isInteger(numId) && numId > 0 ? numId : null;
};

export default function SheriffDetailsPage({
  adapter,
}: {
  adapter: SherriffCaseAdapter;
}) {
  const router = useAdaptiveRouter();
  const listPath = "/user/cases/sheriff";
  const pathname = useAdaptivePathname();
  const returnPage =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("page")
      : null;

  const [caseData, setCaseData] = useState<SheriffCaseData | null>(null);
  const [prevCase, setPrevCase] = useState<SheriffCaseData | null>(null);
  const [nextCase, setNextCase] = useState<SheriffCaseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCase = async () => {
      try {
        setLoading(true);
        const numId = getSheriffIdFromPathname(pathname);
        if (numId === null) {
          setCaseData(null);
          setPrevCase(null);
          setNextCase(null);
          return;
        }

        const [current, prev, next] = await Promise.allSettled([
          adapter.getSheriffCaseById(numId),
          adapter.getSheriffCaseById(numId - 1),
          adapter.getSheriffCaseById(numId + 1),
        ]);

        if (current.status === "fulfilled" && current.value.success) {
          setCaseData(current.value.result);
        } else {
          setCaseData(null);
        }

        if (prev.status === "fulfilled" && prev.value.success) {
          setPrevCase(prev.value.result);
        } else {
          setPrevCase(null);
        }

        if (next.status === "fulfilled" && next.value.success) {
          setNextCase(next.value.result);
        } else {
          setNextCase(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (pathname) fetchCase();
  }, [pathname, adapter]);

  if (loading) return <PageDetailSkeleton />;

  if (!caseData) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            Sheriff case not found
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

  const currentId = getSheriffIdFromPathname(pathname);

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
            <span>Sheriff Cases</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55 font-bold">
              {caseData.caseNumber || `#${caseData.id}`}
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
            Sheriff Case
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {caseData.caseNumber || `#${caseData.id}`}
          </h1>
          <p className="text-[15px] text-base-content/45 font-medium">
            Filed {formatLongDate(caseData.dateFiled)}
          </p>
        </div>

        <div className="h-px bg-base-200" />

        <DetailSection label="Sheriff Information">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <DetailField label="Case Number" value={caseData.caseNumber} />
            <DetailField label="Mortgagee" value={caseData.mortgagee} />
            <DetailField label="Mortgagor" value={caseData.mortgagor} />
            <DetailField label="Sheriff Name" value={caseData.sheriffName} />
            <DetailField
              label="Date Filed"
              value={formatLongDate(caseData.dateFiled)}
            />
            <DetailField
              label="Mode"
              value={caseData.isManual ? "Manual" : "Auto"}
            />
            <div className="md:col-span-2 lg:col-span-3">
              <DetailField label="Remarks" value={caseData.remarks} />
            </div>
          </div>
        </DetailSection>

        <div className="h-px bg-base-200" />
        <div className="flex items-stretch justify-between gap-3">
          <NavButton
            direction="prev"
            label={prevCase?.caseNumber ?? "-"}
            sublabel={prevCase?.sheriffName ?? undefined}
            onClick={() =>
              prevCase &&
              router.push(
                `/user/cases/sheriff/${prevCase.id}${returnPage ? `?page=${encodeURIComponent(returnPage)}` : ""}`,
              )
            }
            disabled={!prevCase}
          />
          <NavButton
            direction="next"
            label={nextCase?.caseNumber ?? "-"}
            sublabel={nextCase?.sheriffName ?? undefined}
            onClick={() =>
              nextCase &&
              router.push(
                `/user/cases/sheriff/${nextCase.id}${returnPage ? `?page=${encodeURIComponent(returnPage)}` : ""}`,
              )
            }
            disabled={!nextCase}
          />
        </div>
      </main>
    </div>
  );
}
