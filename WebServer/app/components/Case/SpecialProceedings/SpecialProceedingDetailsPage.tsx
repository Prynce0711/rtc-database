"use client";

import type { SpecialProceedingData } from "@/app/components/Case/SpecialProceedings/schema";
import {
  getSpecialProceedingById,
  getSpecialProceedings,
} from "@/app/components/Case/SpecialProceedings/SpecialProceedingActions";
import {
  DetailField,
  DetailSection,
  formatLongDate,
  NavButton,
  PageDetailSkeleton,
} from "@rtc-database/shared";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SpecialProceedingDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const [caseData, setCaseData] = useState<SpecialProceedingData | null>(null);
  const [prevCase, setPrevCase] = useState<SpecialProceedingData | null>(null);
  const [nextCase, setNextCase] = useState<SpecialProceedingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "parties">("details");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const numId = Number(params.id);

      // Fetch the current record
      const res = await getSpecialProceedingById(numId);
      if (!res.success || !res.result) {
        setCaseData(null);
        setPrevCase(null);
        setNextCase(null);
        setLoading(false);
        return;
      }
      setCaseData(res.result);

      // Fetch all for prev/next navigation
      const allRes = await getSpecialProceedings();
      if (allRes.success && allRes.result?.items) {
        const all = allRes.result.items;
        const idx = all.findIndex((c) => c.id === numId);
        setPrevCase(idx > 0 ? all[idx - 1] : null);
        setNextCase(idx < all.length - 1 ? all[idx + 1] : null);
      }
      setLoading(false);
    };
    load();
  }, [params.id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return <PageDetailSkeleton />;
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!caseData) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            Record not found
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      {/* ══════════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between gap-4">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[13px] font-semibold text-base-content/40 hover:text-base-content transition-colors duration-150 shrink-0"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9.5 2.5L4.5 7.5L9.5 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[12px] font-semibold text-base-content/30 select-none">
            <span>Special Proceedings</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55 font-bold">
              {caseData.caseNumber}
            </span>
          </div>

          {/* Prev / Next compact */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                prevCase &&
                router.push(`/user/cases/proceedings/${prevCase.id}`)
              }
              disabled={!prevCase}
              title={
                prevCase
                  ? `Previous: ${prevCase.caseNumber}`
                  : "No previous record"
              }
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/35 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 2L4 7L9 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Counter */}
            <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-2 select-none min-w-9 text-center">
              #{currentId}
            </span>

            <button
              onClick={() =>
                nextCase &&
                router.push(`/user/cases/proceedings/${nextCase.id}`)
              }
              disabled={!nextCase}
              title={
                nextCase ? `Next: ${nextCase.caseNumber}` : "No next record"
              }
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/35 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 2L10 7L5 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════ */}
      <main className="max-w-5xl mx-auto px-8 py-14 space-y-10">
        {/* ── Hero Block ───────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/55">
            Special Proceeding
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {caseData.caseNumber}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-[15px] text-base-content/45 font-medium">
              Filed {formatLongDate(caseData.date)}
            </p>
            {caseData.raffledTo && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold bg-base-200 text-base-content/50 border border-base-200">
                {caseData.raffledTo}
              </span>
            )}
          </div>
        </div>

        {/* ── Divider ──────────────────────────────────────── */}
        <div className="h-px bg-base-200" />

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex items-end border-b border-base-200 gap-1">
          {(["details", "parties"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-5 pb-3 pt-1 text-[13px] font-bold capitalize tracking-wide border-b-2 -mb-px transition-all duration-150 whitespace-nowrap",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/30 hover:text-base-content/55",
              ].join(" ")}
            >
              {tab === "details" ? "Case Details" : "Parties & Nature"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB — CASE DETAILS
        ══════════════════════════════════════════ */}
        {activeTab === "details" && (
          <div className="space-y-10 animate-slide-up">
            <DetailSection label="Case Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField label="SPC No." value={caseData.caseNumber} />
                <DetailField
                  label="Raffled to Branch"
                  value={caseData.raffledTo}
                />
                <DetailField
                  label="Date Filed"
                  value={formatLongDate(caseData.date)}
                />
                <div className="md:col-span-2 lg:col-span-3">
                  <DetailField
                    label="Nature of Petition"
                    value={caseData.nature}
                  />
                </div>
              </div>
            </DetailSection>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — PARTIES & NATURE
        ══════════════════════════════════════════ */}
        {activeTab === "parties" && (
          <div className="space-y-10 animate-slide-up">
            <DetailSection label="Parties Involved">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <DetailField label="Petitioners" value={caseData.petitioner} />
                <DetailField label="Respondent" value={caseData.respondent} />
              </div>
            </DetailSection>

            <div className="h-px bg-base-200" />

            <DetailSection label="Nature">
              <div className="grid grid-cols-1 gap-5">
                <DetailField
                  label="Nature of Petition"
                  value={caseData.nature}
                />
              </div>
            </DetailSection>
          </div>
        )}

        {/* ── Prev / Next bottom nav ────────────────────────── */}
        <div className="h-px bg-base-200" />
        <div className="flex items-stretch gap-3">
          <NavButton
            direction="prev"
            label={prevCase?.caseNumber ?? "—"}
            sublabel={prevCase?.petitioner ?? undefined}
            onClick={() =>
              prevCase && router.push(`/user/cases/proceedings/${prevCase.id}`)
            }
            disabled={!prevCase}
          />
          <NavButton
            direction="next"
            label={nextCase?.caseNumber ?? "—"}
            sublabel={nextCase?.petitioner ?? undefined}
            onClick={() =>
              nextCase && router.push(`/user/cases/proceedings/${nextCase.id}`)
            }
            disabled={!nextCase}
          />
        </div>

        {/* ── Footer meta ──────────────────────────────────── */}
        <div className="h-px bg-base-200" />
        <div className="flex items-center justify-between py-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/20 select-none">
            Special Proceedings System
          </p>
          <p className="text-[11px] text-base-content/20 font-semibold select-none">
            Filed {formatLongDate(caseData.date)}
          </p>
        </div>
      </main>
    </div>
  );
}
