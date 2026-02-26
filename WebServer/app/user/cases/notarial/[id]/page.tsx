"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotarialRecord = {
  id: number;
  title: string;
  name: string;
  atty: string;
  date: string;
  link: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_RECORDS: NotarialRecord[] = [
  {
    id: 1,
    title: "NO ENTRY REPORT (NOTARY)",
    name: "ATTY. MELBA G. AGUSTIN-DAVID",
    atty: "ATTY. JUSTIN G. SAMBILE",
    date: "",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. SAMBILE-NOTARIAL REPORT\\2025-09 - No Entry Report (Notary).pdf",
  },
  {
    id: 2,
    title: "NOTARIAL REGISTER",
    name: "ATTY. JOSE P. REYES",
    atty: "ATTY. MARIA S. SANTOS",
    date: "2025-08-15",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. REYES-NOTARIAL REGISTER\\2025-08 - Notarial Register.pdf",
  },
  {
    id: 3,
    title: "MONTHLY REPORT",
    name: "ATTY. ANA L. GARCIA",
    atty: "ATTY. CARLOS B. DELA CRUZ",
    date: "2025-07-30",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. GARCIA-MONTHLY REPORT\\2025-07 - Monthly Report.pdf",
  },
  {
    id: 4,
    title: "NO ENTRY REPORT (NOTARY)",
    name: "ATTY. ROBERTO M. VILLANUEVA",
    atty: "ATTY. ELENA C. FERNANDEZ",
    date: "2025-09-01",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. VILLANUEVA-NOTARIAL REPORT\\2025-09 - No Entry Report.pdf",
  },
  {
    id: 5,
    title: "ANNUAL NOTARIAL REPORT",
    name: "ATTY. LOURDES P. BAUTISTA",
    atty: "ATTY. DANTE R. MORALES",
    date: "2024-12-31",
    link: "RTC-Data\\Notarial Files\\Roxanne\\ATTY. BAUTISTA-ANNUAL REPORT\\2024 - Annual Notarial Report.pdf",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const padId = (id: number) => String(id).padStart(4, "0");

// ─── Field Component ──────────────────────────────────────────────────────────
function Field({
  label,
  value,
  isEmpty = false,
  mono = false,
}: {
  label: string;
  value: string;
  isEmpty?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30 select-none">
        {label}
      </span>
      <div className="px-5 py-4 bg-base-200/70 rounded-xl border border-base-200 min-h-[58px] flex items-center">
        <span
          className={[
            "leading-relaxed",
            mono
              ? "font-mono text-[13px] text-base-content/55 break-all"
              : "text-[15px] font-semibold text-base-content",
            isEmpty ? "italic text-base-content/25 font-normal text-sm" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NotarialViewPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [activeTab, setActiveTab] = useState<"details" | "file">("details");
  const [copied, setCopied] = useState(false);

  const record = MOCK_RECORDS.find((r) => r.id === id);
  const currentIndex = MOCK_RECORDS.findIndex((r) => r.id === id);
  const prevRecord = currentIndex > 0 ? MOCK_RECORDS[currentIndex - 1] : null;
  const nextRecord =
    currentIndex < MOCK_RECORDS.length - 1
      ? MOCK_RECORDS[currentIndex + 1]
      : null;

  const handleCopy = () => {
    if (!record?.link) return;
    navigator.clipboard.writeText(record.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!record) {
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

          {/* Breadcrumb center */}
          <div className="flex items-center gap-2 text-[12px] font-semibold text-base-content/30 select-none">
            <span>Notarial Files</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55">
              Record #{padId(record.id)}
            </span>
          </div>

          {/* Prev / Next */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                prevRecord &&
                router.push(`/user/cases/notarial/${prevRecord.id}`)
              }
              disabled={!prevRecord}
              title="Previous record"
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
            <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-1 select-none">
              {currentIndex + 1} / {MOCK_RECORDS.length}
            </span>
            <button
              onClick={() =>
                nextRecord &&
                router.push(`/user/cases/notarial/${nextRecord.id}`)
              }
              disabled={!nextRecord}
              title="Next record"
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
            Record #{padId(record.id)}
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {record.title}
          </h1>
          <p className="text-[16px] text-base-content/45 font-medium">
            {record.name}
          </p>
        </div>

        {/* ── Horizontal rule ──────────────────────────────── */}
        <div className="h-px bg-base-200" />

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex items-end border-b border-base-200 gap-1">
          {(["details", "file"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-5 pb-3 pt-1 text-[13px] font-bold capitalize tracking-wide border-b-2 -mb-px transition-all duration-150",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/30 hover:text-base-content/55",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB — DETAILS
        ══════════════════════════════════════════ */}
        {activeTab === "details" && (
          <div className="space-y-10 animate-slide-up">
            {/* Section label */}
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30">
              Notarial Information
            </p>

            {/* 3-col fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Field
                label="Document Type"
                value={record.title || "—"}
                isEmpty={!record.title}
              />
              <Field
                label="Notary Public"
                value={record.name || "—"}
                isEmpty={!record.name}
              />
              <Field
                label="Assigned Attorney"
                value={record.atty || "—"}
                isEmpty={!record.atty}
              />
              <Field
                label="Date Filed"
                value={formatDate(record.date)}
                isEmpty={!record.date}
              />
            </div>

            {/* ── File path full width ─────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30">
                  File Location
                </p>
                {record.link && (
                  <button
                    onClick={handleCopy}
                    className={[
                      "text-[12px] font-bold transition-all duration-150",
                      copied
                        ? "text-success"
                        : "text-primary/50 hover:text-primary",
                    ].join(" ")}
                  >
                    {copied ? "Copied!" : "Copy path"}
                  </button>
                )}
              </div>
              <div className="px-5 py-4 bg-base-200/70 rounded-xl border border-base-200">
                <code className="text-[13px] font-mono text-base-content/50 break-all leading-[1.7]">
                  {record.link || "—"}
                </code>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — FILE
        ══════════════════════════════════════════ */}
        {activeTab === "file" && (
          <div className="space-y-6 animate-slide-up">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30">
              Attached File
            </p>

            {/* File card */}
            <div className="rounded-2xl border border-base-200 overflow-hidden bg-base-100">
              {/* File info row */}
              <div className="px-6 py-5 border-b border-base-200 flex items-center gap-5">
                {/* PDF badge */}
                <div className="w-12 h-12 rounded-xl bg-error/8 flex items-center justify-center shrink-0 border border-error/10">
                  <span className="text-[10px] font-black text-error/60 tracking-widest">
                    PDF
                  </span>
                </div>

                {/* File name + path */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="text-[15px] font-bold text-base-content leading-tight truncate">
                    {record.link.split("\\").pop() ?? "File"}
                  </p>
                  <p className="text-[12px] text-base-content/35 font-medium truncate">
                    {record.link.split("\\").slice(0, -1).join(" › ")}
                  </p>
                </div>

                {/* Copy button */}
                <button
                  onClick={handleCopy}
                  className={[
                    "shrink-0 px-4 py-2 rounded-lg text-[12px] font-bold border transition-all duration-150",
                    copied
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-base-200/60 border-base-200 text-base-content/40 hover:text-base-content/70 hover:border-base-content/15",
                  ].join(" ")}
                >
                  {copied ? "Copied!" : "Copy path"}
                </button>
              </div>

              {/* Preview placeholder */}
              <div className="px-6 py-20 text-center space-y-2 bg-base-200/30">
                <p className="text-[13px] font-semibold text-base-content/25">
                  Preview not available
                </p>
                <p className="text-[12px] text-base-content/18">
                  Open the file directly from the path above.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer meta ──────────────────────────────────── */}
        <div className="pt-4 h-px bg-base-200" />
        <div className="flex items-center justify-between py-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/20 select-none">
            Notarial Filing System
          </p>
          {record.date && (
            <p className="text-[11px] text-base-content/20 font-semibold select-none">
              Filed {formatDate(record.date)}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
