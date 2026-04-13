"use client";

import { getSheriffCaseById } from "@/app/components/Case/Sherriff/SherriffActions";
import type { SheriffCaseData } from "@/app/components/Case/Sherriff/schema";
import {
  DetailField,
  DetailSection,
  formatLongDate,
  NavButton,
  PageDetailSkeleton,
} from "@rtc-database/shared";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SheriffDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const [caseData, setCaseData] = useState<SheriffCaseData | null>(null);
  const [prevCase, setPrevCase] = useState<SheriffCaseData | null>(null);
  const [nextCase, setNextCase] = useState<SheriffCaseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCase = async () => {
      try {
        setLoading(true);
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        const numId = Number(id);

        const [current, prev, next] = await Promise.allSettled([
          getSheriffCaseById(numId),
          getSheriffCaseById(numId - 1),
          getSheriffCaseById(numId + 1),
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

    if (params.id) fetchCase();
  }, [params.id]);

  if (loading) return <PageDetailSkeleton />;

  if (!caseData) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            Sheriff case not found
          </p>
          <button
            onClick={() => router.back()}
            className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity underline underline-offset-4"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const currentId = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
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
            #{currentId}
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
              prevCase && router.push(`/user/cases/sheriff/${prevCase.id}`)
            }
            disabled={!prevCase}
          />
          <NavButton
            direction="next"
            label={nextCase?.caseNumber ?? "-"}
            sublabel={nextCase?.sheriffName ?? undefined}
            onClick={() =>
              nextCase && router.push(`/user/cases/sheriff/${nextCase.id}`)
            }
            disabled={!nextCase}
          />
        </div>
      </main>
    </div>
  );
}
