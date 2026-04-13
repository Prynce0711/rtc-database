"use client";

import { getCivilCaseById } from "@/app/components/Case/Civil/CivilActions";
import type { CivilCaseData } from "@/app/components/Case/Civil/schema";
import {
  DetailField,
  DetailSection,
  formatLongDate,
  NavButton,
} from "@rtc-database/shared";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CivilCaseDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const [caseData, setCaseData] = useState<CivilCaseData | null>(null);
  const [prevCase, setPrevCase] = useState<CivilCaseData | null>(null);
  const [nextCase, setNextCase] = useState<CivilCaseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCase = async () => {
      try {
        setLoading(true);
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        const numId = Number(id);

        const [current, prev, next] = await Promise.allSettled([
          getCivilCaseById(numId),
          getCivilCaseById(numId - 1),
          getCivilCaseById(numId + 1),
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

  if (!caseData) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            Case not found
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

  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between gap-4">
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

          <div className="flex items-center gap-2 text-[12px] font-semibold text-base-content/30 select-none">
            <span>Cases</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55 font-bold">
              {caseData.caseNumber ?? `#${caseData.id}`}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                prevCase && router.push(`/user/cases/civil/${prevCase.id}`)
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

            <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-2 select-none min-w-9 text-center">
              #{Array.isArray(params.id) ? params.id[0] : params.id}
            </span>

            <button
              onClick={() =>
                nextCase && router.push(`/user/cases/civil/${nextCase.id}`)
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

      <main className="max-w-5xl mx-auto px-8 py-14 space-y-10">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/55">
            Civil Case
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {caseData.caseNumber ?? `#${caseData.id}`}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-[15px] text-base-content/45 font-medium">
              Filed {formatLongDate(caseData.dateFiled)}
            </p>
            {caseData.branch && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold bg-base-200 text-base-content/50 border border-base-200">
                Branch {caseData.branch}
              </span>
            )}
          </div>
        </div>

        <div className="h-px bg-base-200" />

        <div className="flex items-end border-b border-base-200 gap-1">
          <button className="px-5 pb-3 pt-1 text-[13px] font-bold capitalize tracking-wide border-b-2 -mb-px transition-all duration-150 whitespace-nowrap border-primary text-primary">
            Case Details
          </button>
        </div>

        <div className="space-y-10 animate-slide-up">
          <DetailSection label="Case Overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <DetailField label="Case Number" value={caseData.caseNumber} />
              <DetailField label="Branch" value={caseData.branch} />
              <DetailField label="Petitioner/s" value={caseData.petitioners} />
              <DetailField label="Defendant/s" value={caseData.defendants} />
              <DetailField
                label="Date Filed"
                value={formatLongDate(caseData.dateFiled)}
              />
              <DetailField label="Notes/Appealed" value={caseData.notes} />
              <DetailField label="Nature of Petition" value={caseData.nature} />
            </div>
          </DetailSection>
        </div>

        <div className="h-px bg-base-200" />
        <div className="flex items-stretch justify-between gap-3">
          <NavButton
            direction="prev"
            label={prevCase?.caseNumber ?? "—"}
            sublabel={prevCase?.petitioners ?? undefined}
            onClick={() =>
              prevCase && router.push(`/user/cases/civil/${prevCase.id}`)
            }
            disabled={!prevCase}
          />
          <NavButton
            direction="next"
            label={nextCase?.caseNumber ?? "—"}
            sublabel={nextCase?.petitioners ?? undefined}
            onClick={() =>
              nextCase && router.push(`/user/cases/civil/${nextCase.id}`)
            }
            disabled={!nextCase}
          />
        </div>

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
