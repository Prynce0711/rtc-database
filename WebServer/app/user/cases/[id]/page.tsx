"use client";

import { getCaseById } from "@/app/components/Case/CasesActions";
import type { Case } from "@/app/generated/prisma/browser";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Prev/Next Nav Button ─────────────────────────────────────────────────────
const NavButton = ({
  direction,
  label,
  sublabel,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled: boolean;
}) => {
  const isPrev = direction === "prev";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 min-w-0",
        disabled
          ? "opacity-25 cursor-not-allowed border-base-200 bg-transparent"
          : "border-base-200 bg-base-100 hover:bg-base-200/60 hover:border-base-content/15",
        isPrev ? "" : "flex-row-reverse text-right",
      ].join(" ")}
    >
      {/* Chevron */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 text-base-content/30 group-hover:text-base-content/60 transition-colors"
        aria-hidden="true"
      >
        {isPrev ? (
          <path
            d="M10 3L5 8L10 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M6 3L11 8L6 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      {/* Text */}
      <div
        className={["min-w-0", isPrev ? "" : "items-end flex flex-col"].join(
          " ",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/25 select-none leading-none mb-1">
          {isPrev ? "Previous" : "Next"}
        </p>
        <p className="text-[13px] font-bold text-base-content/60 group-hover:text-base-content truncate max-w-[160px] transition-colors leading-snug">
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-base-content/30 truncate max-w-[160px] leading-snug mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
    </button>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ─── Detail Field ─────────────────────────────────────────────────────────────
const Detail = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: any;
  mono?: boolean;
}) => {
  const isEmpty =
    value === null || value === undefined || value === "" || value === "N/A";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30 select-none">
        {label}
      </span>
      <div
        className={[
          "px-5 py-4 rounded-xl border min-h-[58px] flex items-center",
          isEmpty
            ? "bg-base-200/40 border-base-200/60"
            : "bg-base-200/70 border-base-200",
        ].join(" ")}
      >
        <span
          className={[
            "leading-relaxed",
            isEmpty
              ? "text-[13px] italic text-base-content/25 font-normal"
              : mono
                ? "font-mono text-[13px] text-base-content/60"
                : "text-[15px] font-semibold text-base-content",
          ].join(" ")}
        >
          {isEmpty ? "—" : String(value)}
        </span>
      </div>
    </div>
  );
};

// ─── Section Block ────────────────────────────────────────────────────────────
const Section = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-5">
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30">
      {label}
    </p>
    {children}
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CaseDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [prevCase, setPrevCase] = useState<Case | null>(null);
  const [nextCase, setNextCase] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "additional">(
    "details",
  );

  useEffect(() => {
    const fetchCase = async () => {
      try {
        setLoading(true);
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        const numId = Number(id);

        // Fetch current + adjacent cases in parallel
        const [current, prev, next] = await Promise.allSettled([
          getCaseById(numId),
          getCaseById(numId - 1),
          getCaseById(numId + 1),
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
    if (params.id) fetchCase();
  }, [params.id]);

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
            onClick={() => router.push("/user/cases")}
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
            onClick={() => router.push("/user/cases")}
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
                prevCase && router.push(`/user/cases/${prevCase.id}`)
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
            <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-2 select-none min-w-[36px] text-center">
              #{Array.isArray(params.id) ? params.id[0] : params.id}
            </span>

            <button
              onClick={() =>
                nextCase && router.push(`/user/cases/${nextCase.id}`)
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
              Filed {formatDate(caseData.dateFiled)}
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
            <Section label="Case Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="Case Number" value={caseData.caseNumber} />
                <Detail label="Branch" value={caseData.branch} />
                <Detail
                  label="Assistant Branch"
                  value={caseData.assistantBranch}
                />
                <Detail label="Accused" value={caseData.name} />
                <Detail label="Charge" value={caseData.charge} />
                <Detail label="Court" value={caseData.court} />
                <Detail label="Info Sheet" value={caseData.infoSheet} />
                <Detail label="Bond" value={caseData.bond} />
                <Detail label="EQC Number" value={caseData.eqcNumber} />
                <Detail label="Consolidation" value={caseData.consolidation} />
                <Detail
                  label="Date Filed"
                  value={formatDate(caseData.dateFiled)}
                />
                <Detail
                  label="Raffle Date"
                  value={formatDate(caseData.raffleDate)}
                />
              </div>
            </Section>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — ADDITIONAL INFO
        ══════════════════════════════════════════ */}
        {activeTab === "additional" && (
          <div className="space-y-12 animate-slide-up">
            {/* Parties */}
            <Section label="Parties">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="Judge" value={caseData.judge} />
                <Detail label="AO" value={caseData.ao} />
                <Detail label="Complainant" value={caseData.complainant} />
              </div>
            </Section>

            {/* Divider */}
            <div className="h-px bg-base-200" />

            {/* Committee */}
            <Section label="Committee">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Detail label="Committee 1" value={caseData.committee1} />
                <Detail label="Committee 2" value={caseData.committee2} />
              </div>
            </Section>

            {/* Divider */}
            <div className="h-px bg-base-200" />

            {/* Address */}
            <Section label="Address">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="House No." value={caseData.houseNo} />
                <Detail label="Street" value={caseData.street} />
                <Detail label="Barangay" value={caseData.barangay} />
                <Detail label="Municipality" value={caseData.municipality} />
                <Detail label="Province" value={caseData.province} />
              </div>
            </Section>

            {/* Divider */}
            <div className="h-px bg-base-200" />

            {/* Financial */}
            <Section label="Financial Details">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="Counts" value={caseData.counts} />
                <Detail label="JDF" value={caseData.jdf} mono />
                <Detail label="SAJJ" value={caseData.sajj} mono />
                <Detail label="SAJJ2" value={caseData.sajj2} mono />
                <Detail label="MF" value={caseData.mf} mono />
                <Detail label="STF" value={caseData.stf} mono />
                <Detail label="LRF" value={caseData.lrf} mono />
                <Detail label="VCF" value={caseData.vcf} mono />
                <Detail label="Total" value={caseData.total} mono />
                <Detail
                  label="Amount Involved"
                  value={caseData.amountInvolved}
                  mono
                />
              </div>
            </Section>
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
              prevCase && router.push(`/user/cases/${prevCase.id}`)
            }
            disabled={!prevCase}
          />
          <NavButton
            direction="next"
            label={nextCase?.caseNumber ?? "—"}
            sublabel={nextCase?.name ?? undefined}
            onClick={() =>
              nextCase && router.push(`/user/cases/${nextCase.id}`)
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
            Filed {formatDate(caseData.dateFiled)}
          </p>
        </div>
      </main>
    </div>
  );
}
