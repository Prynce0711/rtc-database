import React from "react";
import { MTCJudgementLog, RTCJudgementLog } from "./JudgementRecord";

/* ── Same column definition types as Annual ── */

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render: (row: Record<string, unknown>) => React.ReactNode;
  computeValue?: (row: Record<string, unknown>) => number;
}

export interface GroupColumnDef {
  title: string;
  align?: "left" | "center" | "right";
  children: ColumnDef[];
}

export type AnyColumnDef = ColumnDef | GroupColumnDef;

export function isGroupColumn(col: AnyColumnDef): col is GroupColumnDef {
  return "children" in col;
}

export function flattenColumns(cols: AnyColumnDef[]): ColumnDef[] {
  return cols.flatMap((c) => (isGroupColumn(c) ? c.children : [c]));
}

/** Also keep LeafColumn alias for backward compat */
export type LeafColumn = ColumnDef;

const v = (row: Record<string, unknown>, key: string): React.ReactNode =>
  (row[key] as string | number | null | undefined) ?? "—";

/* ──────────────────────────────────────────────────────────────────── */
/*  MTC Columns                                                        */
/* ──────────────────────────────────────────────────────────────────── */

export const mtcColumns: AnyColumnDef[] = [
  {
    key: "branchNo",
    label: "Branch No.",
    sortable: true,
    align: "center",
    render: (r) => v(r, "branchNo"),
  },
  {
    title: "CASES HEARD / TRIED",
    align: "center",
    children: [
      {
        key: "civilV",
        label: "Civil V",
        align: "center",
        render: (r) => v(r, "civilV"),
      },
      {
        key: "civilInC",
        label: "Civil In-C",
        align: "center",
        render: (r) => v(r, "civilInC"),
      },
      {
        key: "criminalV",
        label: "Crim V",
        align: "center",
        render: (r) => v(r, "criminalV"),
      },
      {
        key: "criminalInC",
        label: "Crim In-C",
        align: "center",
        render: (r) => v(r, "criminalInC"),
      },
      {
        key: "totalHeard",
        label: "Total Heard",
        align: "center",
        render: (r) => v(r, "totalHeard"),
      },
    ],
  },
  {
    title: "CASES DISPOSED",
    align: "center",
    children: [
      {
        key: "disposedCivil",
        label: "Civil",
        align: "center",
        render: (r) => v(r, "disposedCivil"),
      },
      {
        key: "disposedCrim",
        label: "Crim",
        align: "center",
        render: (r) => v(r, "disposedCrim"),
      },
      {
        key: "totalDisposed",
        label: "Total Disposed",
        align: "center",
        render: (r) => v(r, "totalDisposed"),
      },
    ],
  },
  {
    title: "PDL / CICL",
    align: "center",
    children: [
      { key: "pdlM", label: "M", align: "center", render: (r) => v(r, "pdlM") },
      { key: "pdlF", label: "F", align: "center", render: (r) => v(r, "pdlF") },
      {
        key: "pdlTotal",
        label: "Total",
        align: "center",
        render: (r) => v(r, "pdlTotal"),
      },
    ],
  },
  {
    title: "PDL RELEASED",
    align: "center",
    children: [
      { key: "pdlV", label: "V", align: "center", render: (r) => v(r, "pdlV") },
      { key: "pdlI", label: "I", align: "center", render: (r) => v(r, "pdlI") },
      {
        key: "pdlBail",
        label: "Bail",
        align: "center",
        render: (r) => v(r, "pdlBail"),
      },
      {
        key: "pdlRecognizance",
        label: "Recognizance",
        align: "center",
        render: (r) => v(r, "pdlRecognizance"),
      },
      {
        key: "pdlMinRor",
        label: "Min/ror",
        align: "center",
        render: (r) => v(r, "pdlMinRor"),
      },
      {
        key: "pdlMaxSentence",
        label: "Max Sentence",
        align: "center",
        render: (r) => v(r, "pdlMaxSentence"),
      },
      {
        key: "pdlDismissal",
        label: "Dismissal",
        align: "center",
        render: (r) => v(r, "pdlDismissal"),
      },
      {
        key: "pdlAcquittal",
        label: "Acquittal",
        align: "center",
        render: (r) => v(r, "pdlAcquittal"),
      },
      {
        key: "pdlMinSentence",
        label: "Min Sentence",
        align: "center",
        render: (r) => v(r, "pdlMinSentence"),
      },
      {
        key: "pdlOthers",
        label: "Others",
        align: "center",
        render: (r) => v(r, "pdlOthers"),
      },
    ],
  },
  {
    key: "total",
    label: "TOTAL",
    sortable: true,
    align: "center",
    render: (r) => <span className="font-semibold">{v(r, "total")}</span>,
  },
];

/** Flat leaf columns for MTC (backward compat) */
export const mtcLeafColumns: LeafColumn[] = flattenColumns(mtcColumns);

/* ──────────────────────────────────────────────────────────────────── */
/*  RTC Columns                                                        */
/* ──────────────────────────────────────────────────────────────────── */

export const rtcColumns: AnyColumnDef[] = [
  {
    key: "branchNo",
    label: "Branch No.",
    sortable: true,
    align: "center",
    render: (r) => v(r, "branchNo"),
  },
  {
    title: "CASES HEARD / TRIED",
    align: "center",
    children: [
      {
        key: "civilV",
        label: "Civil V",
        align: "center",
        render: (r) => v(r, "civilV"),
      },
      {
        key: "civilInC",
        label: "Civil In-C",
        align: "center",
        render: (r) => v(r, "civilInC"),
      },
      {
        key: "criminalV",
        label: "Crim V",
        align: "center",
        render: (r) => v(r, "criminalV"),
      },
      {
        key: "criminalInC",
        label: "Crim In-C",
        align: "center",
        render: (r) => v(r, "criminalInC"),
      },
      {
        key: "totalHeard",
        label: "Total Heard",
        align: "center",
        render: (r) => v(r, "totalHeard"),
      },
    ],
  },
  {
    title: "CASES DISPOSED",
    align: "center",
    children: [
      {
        key: "disposedCivil",
        label: "Civil",
        align: "center",
        render: (r) => v(r, "disposedCivil"),
      },
      {
        key: "disposedCrim",
        label: "Crim",
        align: "center",
        render: (r) => v(r, "disposedCrim"),
      },
      {
        key: "summaryProc",
        label: "Summary Proc",
        align: "center",
        render: (r) => v(r, "summaryProc"),
      },
      {
        key: "casesDisposed",
        label: "Cases Disposed",
        align: "center",
        render: (r) => v(r, "casesDisposed"),
      },
    ],
  },
  {
    title: "PDL / CICL",
    align: "center",
    children: [
      { key: "pdlM", label: "M", align: "center", render: (r) => v(r, "pdlM") },
      { key: "pdlF", label: "F", align: "center", render: (r) => v(r, "pdlF") },
      {
        key: "pdlCICL",
        label: "CICL",
        align: "center",
        render: (r) => v(r, "pdlCICL"),
      },
      {
        key: "pdlTotal",
        label: "Total",
        align: "center",
        render: (r) => v(r, "pdlTotal"),
      },
    ],
  },
  {
    title: "PDL RELEASED",
    align: "center",
    children: [
      { key: "pdlV", label: "V", align: "center", render: (r) => v(r, "pdlV") },
      {
        key: "pdlInC",
        label: "In-C",
        align: "center",
        render: (r) => v(r, "pdlInC"),
      },
      {
        key: "pdlBail",
        label: "Bail",
        align: "center",
        render: (r) => v(r, "pdlBail"),
      },
      {
        key: "pdlRecognizance",
        label: "Recognizance",
        align: "center",
        render: (r) => v(r, "pdlRecognizance"),
      },
      {
        key: "pdlMinRor",
        label: "Min/ror",
        align: "center",
        render: (r) => v(r, "pdlMinRor"),
      },
      {
        key: "pdlMaxSentence",
        label: "Max Sentence",
        align: "center",
        render: (r) => v(r, "pdlMaxSentence"),
      },
      {
        key: "pdlDismissal",
        label: "Dismissal",
        align: "center",
        render: (r) => v(r, "pdlDismissal"),
      },
      {
        key: "pdlAcquittal",
        label: "Acquittal",
        align: "center",
        render: (r) => v(r, "pdlAcquittal"),
      },
      {
        key: "pdlMinSentence",
        label: "Min Sentence",
        align: "center",
        render: (r) => v(r, "pdlMinSentence"),
      },
      {
        key: "pdlProbation",
        label: "Probation",
        align: "center",
        render: (r) => v(r, "pdlProbation"),
      },
    ],
  },
  {
    title: "CICL",
    align: "center",
    children: [
      {
        key: "ciclM",
        label: "M",
        align: "center",
        render: (r) => v(r, "ciclM"),
      },
      {
        key: "ciclF",
        label: "F",
        align: "center",
        render: (r) => v(r, "ciclF"),
      },
      {
        key: "ciclV",
        label: "V",
        align: "center",
        render: (r) => v(r, "ciclV"),
      },
      {
        key: "ciclInC",
        label: "In-C",
        align: "center",
        render: (r) => v(r, "ciclInC"),
      },
    ],
  },
  {
    key: "fine",
    label: "Fine",
    sortable: false,
    align: "center",
    render: (r) => v(r, "fine"),
  },
  {
    key: "total",
    label: "TOTAL",
    sortable: true,
    align: "center",
    render: (r) => <span className="font-semibold">{v(r, "total")}</span>,
  },
];

/** Flat leaf columns for RTC (backward compat) */
export const rtcLeafColumns: LeafColumn[] = flattenColumns(rtcColumns);

export type { MTCJudgementLog, RTCJudgementLog };
