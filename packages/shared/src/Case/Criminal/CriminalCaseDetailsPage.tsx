"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAdaptiveNavigation,
  useAdaptivePathname,
} from "../../lib/nextCompat";
import {
  DetailField,
  DetailSection,
  formatLongDate,
} from "../CaseDetailsShared";
import NavButton from "../NavButton";
import type { CriminalCaseAdapter } from "./CriminalCaseAdapter";
import type { CriminalCaseData } from "./CriminalCaseSchema";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CriminalCaseDetailsPage({
  adapter,
}: {
  adapter: CriminalCaseAdapter;
}) {
  const router = useAdaptiveNavigation();
  const listPath = "/user/cases/criminal";
  const pathname = useAdaptivePathname();
  const idParam = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : "";
  }, [pathname]);

  const [caseData, setCaseData] = useState<CriminalCaseData | null>(null);
  const [prevCase, setPrevCase] = useState<CriminalCaseData | null>(null);
  const [nextCase, setNextCase] = useState<CriminalCaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "additional">(
    "details",
  );

  useEffect(() => {
    const fetchCase = async () => {
      try {
        setLoading(true);
        const numId = Number(idParam);

        // Fetch current + adjacent cases in parallel
        const [current, prev, next] = await Promise.allSettled([
          adapter.getCriminalCaseById(numId),
          adapter.getCriminalCaseById(numId - 1),
          adapter.getCriminalCaseById(numId + 1),
        ]);

        if (current.status === "fulfilled" && current.value.success)
          setCaseData(current.value.result);
        if (prev.status === "fulfilled" && prev.value.success)
          setPrevCase(prev.value.result);
        else setPrevCase(null);
        if (next.status === "fulfilled" && next.value.success)
          setNextCase(next.value.result);
        else setNextCase(null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (idParam) fetchCase();
  }, [idParam, adapter]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-md text-primary/40" />
          <p className="text-[12px] font-bold uppercase tracking-widest text-base-content/25 select-none">
            Loading case…
          </p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!caseData) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            Case not found
          </p>
          <button
            onClick={() => router.push(listPath)}
            className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity underline underline-offset-4"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

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
            onClick={() => router.push(listPath)}
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
            <span>Cases</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55 font-bold">
              {caseData.caseNumber}
            </span>
          </div>

          {/* Prev / Next compact */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                prevCase && router.push(`/user/cases/criminal/${prevCase.id}`)
              }
              disabled={!prevCase}
              title={
                prevCase
                  ? `Previous: ${prevCase.caseNumber}`
                  : "No previous case"
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

            {/* ID counter */}
            <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-2 select-none min-w-9 text-center">
              #{idParam}
            </span>

            <button
              onClick={() =>
                nextCase && router.push(`/user/cases/criminal/${nextCase.id}`)
              }
              disabled={!nextCase}
              title={nextCase ? `Next: ${nextCase.caseNumber}` : "No next case"}
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
            Case Record
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {caseData.caseNumber}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-[15px] text-base-content/45 font-medium">
              Filed {formatLongDate(caseData.dateFiled)}
            </p>

            {/* Detention badge */}
            <span
              className={[
                "inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold border",
                caseData.detained
                  ? "bg-error/8 text-error border-error/15"
                  : "bg-success/8 text-success border-success/15",
              ].join(" ")}
            >
              {caseData.detained ? "Detained" : "Released"}
            </span>

            {/* Branch badge */}
            {caseData.branch && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold bg-base-200 text-base-content/50 border border-base-200">
                {caseData.branch}
              </span>
            )}
          </div>
        </div>

        {/* ── Divider ──────────────────────────────────────── */}
        <div className="h-px bg-base-200" />

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex items-end border-b border-base-200 gap-1">
          {(["details", "additional"] as const).map((tab) => (
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
              {tab === "details" ? "Case Details" : "Additional Info"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB — CASE DETAILS
        ══════════════════════════════════════════ */}
        {activeTab === "details" && (
          <div className="space-y-10 animate-slide-up">
            <DetailSection label="Case Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField label="Case Number" value={caseData.caseNumber} />
                <DetailField label="Branch" value={caseData.branch} />
                <DetailField
                  label="Assistant Branch"
                  value={caseData.assistantBranch}
                />
                <DetailField label="Accused" value={caseData.name} />
                <DetailField label="Charge" value={caseData.charge} />
                <DetailField label="Court" value={caseData.court} />
                <DetailField label="Info Sheet" value={caseData.infoSheet} />
                <DetailField label="Bond" value={caseData.bond} />
                <DetailField label="EQC Number" value={caseData.eqcNumber} />
                <DetailField
                  label="Consolidation"
                  value={caseData.consolidation}
                />
                <DetailField
                  label="Date Filed"
                  value={formatLongDate(caseData.dateFiled)}
                />
                <DetailField
                  label="Raffle Date"
                  value={formatLongDate(caseData.raffleDate)}
                />
              </div>
            </DetailSection>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — ADDITIONAL INFO
        ══════════════════════════════════════════ */}
        {activeTab === "additional" && (
          <div className="space-y-12 animate-slide-up">
            {/* Parties */}
            <DetailSection label="Parties">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField label="Judge" value={caseData.judge} />
                <DetailField label="AO" value={caseData.ao} />
                <DetailField label="Complainant" value={caseData.complainant} />
              </div>
            </DetailSection>

            {/* Divider */}
            <div className="h-px bg-base-200" />

            {/* Committee */}
            <DetailSection label="Committee">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <DetailField label="Committee 1" value={caseData.committee1} />
                <DetailField label="Committee 2" value={caseData.committee2} />
              </div>
            </DetailSection>

            {/* Divider */}
            <div className="h-px bg-base-200" />

            {/* Address */}
            <DetailSection label="Address">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField label="House No." value={caseData.houseNo} />
                <DetailField label="Street" value={caseData.street} />
                <DetailField label="Barangay" value={caseData.barangay} />
                <DetailField
                  label="Municipality"
                  value={caseData.municipality}
                />
                <DetailField label="Province" value={caseData.province} />
              </div>
            </DetailSection>

            {/* Divider */}
            <div className="h-px bg-base-200" />

            {/* Financial */}
            <DetailSection label="Financial Details">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField label="Counts" value={caseData.counts} />
                <DetailField label="JDF" value={caseData.jdf} mono />
                <DetailField label="SAJJ" value={caseData.sajj} mono />
                <DetailField label="SAJJ2" value={caseData.sajj2} mono />
                <DetailField label="MF" value={caseData.mf} mono />
                <DetailField label="STF" value={caseData.stf} mono />
                <DetailField label="LRF" value={caseData.lrf} mono />
                <DetailField label="VCF" value={caseData.vcf} mono />
                <DetailField label="Total" value={caseData.total} mono />
                <DetailField
                  label="Amount Involved"
                  value={caseData.amountInvolved}
                  mono
                />
              </div>
            </DetailSection>
          </div>
        )}

        {/* ── Prev / Next bottom nav ────────────────────────── */}
        <div className="h-px bg-base-200" />
        <div className="flex items-stretch justify-between gap-3">
          <NavButton
            direction="prev"
            label={prevCase?.caseNumber ?? "—"}
            sublabel={prevCase?.name ?? undefined}
            onClick={() =>
              prevCase && router.push(`/user/cases/criminal/${prevCase.id}`)
            }
            disabled={!prevCase}
          />
          <NavButton
            direction="next"
            label={nextCase?.caseNumber ?? "—"}
            sublabel={nextCase?.name ?? undefined}
            onClick={() =>
              nextCase && router.push(`/user/cases/criminal/${nextCase.id}`)
            }
            disabled={!nextCase}
          />
        </div>

        {/* ── Footer meta ──────────────────────────────────── */}
        <div className="h-px bg-base-200" />
        <div className="flex items-center justify-between py-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/20 select-none">
            Case Filing System
          </p>
          <p className="text-[11px] text-base-content/20 font-semibold select-none">
            Filed {formatLongDate(caseData.dateFiled)}
          </p>
        </div>
      </main>
    </div>
  );
}
