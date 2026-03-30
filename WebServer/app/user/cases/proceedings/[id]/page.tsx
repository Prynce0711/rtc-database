"use client";

import type { SpecialProceedingData } from "@/app/components/Case/SpecialProceedings/schema";
import {
  getSpecialProceedingById,
  getSpecialProceedings,
} from "@/app/components/Case/SpecialProceedings/SpecialProceedingActions";
import { PageDetailSkeleton } from "@/app/components/Skeleton/SkeletonTable";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ─── Detail Field ─────────────────────────────────────────────────────────────
const Detail = ({ label, value }: { label: string; value: any }) => {
  const isEmpty =
    value === null || value === undefined || value === "" || value === "N/A";

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30 select-none">
        {label}
      </span>
      <div
        className={[
          "px-5 py-4 rounded-xl border min-h-14.5 flex items-center",
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
    <p className="text-[15px] font-bold uppercase tracking-[0.14em] text-base-content">
      {label}
    </p>
    {children}
  </div>
);

// ─── Nav Button (bottom prev/next) ────────────────────────────────────────────
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
        "group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 min-w-0 flex-1",
        disabled
          ? "opacity-25 cursor-not-allowed border-base-200 bg-transparent"
          : "border-base-200 bg-base-100 hover:bg-base-200/60 hover:border-base-content/15",
        !isPrev ? "flex-row-reverse" : "",
      ].join(" ")}
    >
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
      <div
        className={["min-w-0", !isPrev ? "items-end flex flex-col" : ""].join(
          " ",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/25 select-none leading-none mb-1">
          {isPrev ? "Previous" : "Next"}
        </p>
        <p className="text-[13px] font-bold text-base-content/60 group-hover:text-base-content truncate max-w-50 transition-colors leading-snug">
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-base-content/30 truncate max-w-50 leading-snug mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
    </button>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProceedingDetailsPage() {
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
              Filed {formatDate(caseData.date)}
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
            <Section label="Case Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="SPC No." value={caseData.caseNumber} />
                <Detail label="Raffled to Branch" value={caseData.raffledTo} />
                <Detail label="Date Filed" value={formatDate(caseData.date)} />
                <div className="md:col-span-2 lg:col-span-3">
                  <Detail label="Nature of Petition" value={caseData.nature} />
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — PARTIES & NATURE
        ══════════════════════════════════════════ */}
        {activeTab === "parties" && (
          <div className="space-y-10 animate-slide-up">
            <Section label="Parties Involved">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Detail label="Petitioners" value={caseData.petitioner} />
                <Detail label="Respondent" value={caseData.respondent} />
              </div>
            </Section>

            <div className="h-px bg-base-200" />

            <Section label="Nature">
              <div className="grid grid-cols-1 gap-5">
                <Detail label="Nature of Petition" value={caseData.nature} />
              </div>
            </Section>
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
            Filed {formatDate(caseData.date)}
          </p>
        </div>
      </main>
    </div>
  );
}
