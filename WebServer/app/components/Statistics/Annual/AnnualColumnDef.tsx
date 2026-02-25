// Column definitions for the generic AnnualTable component

import React from "react";
import { CourtLog, InventoryLog } from "./AnnualRecord";

// Helper: double-cast through unknown to avoid TS struct-overlap error
const asCourt = (r: Record<string, unknown>) => r as unknown as CourtLog;
const asInventory = (r: Record<string, unknown>) =>
  r as unknown as InventoryLog;

/** A single leaf column with its own data cell */
export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render: (row: Record<string, unknown>) => React.ReactNode;
}

/** A group column that renders a colspan header and has child leaf columns */
export interface GroupColumnDef {
  title: string;
  align?: "left" | "center" | "right";
  children: ColumnDef[];
}

/** Union of flat and group columns */
export type AnyColumnDef = ColumnDef | GroupColumnDef;

export function isGroupColumn(col: AnyColumnDef): col is GroupColumnDef {
  return "children" in col;
}

/** Flatten all leaf columns from a mixed flat/group column array */
export function flattenColumns(cols: AnyColumnDef[]): ColumnDef[] {
  return cols.flatMap((c) => (isGroupColumn(c) ? c.children : [c]));
}

// Columns shared by MTC and RTC
export const courtColumns: ColumnDef[] = [
  {
    key: "bookAndPages",
    label: "Branch",
    sortable: true,
    align: "center",
    render: (r) => asCourt(r).bookAndPages || "—",
  },
  {
    key: "pendingLastYear",
    label: "Pending Last Year",
    sortable: true,
    align: "center",
    render: (r) => asCourt(r).pendingLastYear || "—",
  },
  {
    key: "RaffledOrAdded",
    label: "Raffled/Added",
    sortable: false,
    align: "center",
    render: (r) => asCourt(r).RaffledOrAdded || "—",
  },
  {
    key: "Disposed",
    label: "Disposed",
    sortable: true,
    align: "center",
    render: (r) => asCourt(r).Disposed || "—",
  },
  {
    key: "pendingThisYear",
    label: "Pending Year Now",
    sortable: true,
    align: "center",
    render: (r) => asCourt(r).pendingThisYear || "—",
  },
  {
    key: "percentageOfDisposition",
    label: "percentage of Disposition",
    sortable: true,
    align: "center",
    render: (r) => asCourt(r).percentageOfDisposition || "—",
  },
];

// Columns for Inventory
export const inventoryColumns: AnyColumnDef[] = [
  {
    key: "Region",
    label: "Region",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).Region || "—",
  },
  {
    key: "province",
    label: "Province",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).province || "—",
  },
  {
    key: "Court",
    label: "Court",
    sortable: false,
    align: "center",
    render: (r) => asInventory(r).Court || "—",
  },
  {
    key: "CityMunicipality",
    label: "City/Municipality",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).CityMunicipality || "—",
  },
  {
    key: "Branch",
    label: "Branch",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).Branch || "—",
  },
  {
    title: "CASES FILED",
    align: "center",
    children: [
      {
        key: "civilSmallClaimsFiled",
        label: "CIVIL / SMALL CLAIMS",
        sortable: false,
        align: "center",
        render: (r) => asInventory(r).civilSmallClaimsFiled ?? "—",
      },
      {
        key: "criminalCasesFiled",
        label: "CRIMINAL CASES",
        sortable: false,
        align: "center",
        render: (r) => asInventory(r).criminalCasesFiled ?? "—",
      },
    ],
  },
  {
    title: "CASES DISPOSED",
    align: "center",
    children: [
      {
        key: "civilSmallClaimsDisposed",
        label: "CIVIL / SMALL CLAIMS",
        sortable: false,
        align: "center",
        render: (r) => asInventory(r).civilSmallClaimsDisposed ?? "—",
      },
      {
        key: "criminalCasesDisposed",
        label: "CRIMINAL CASES",
        sortable: false,
        align: "center",
        render: (r) => asInventory(r).criminalCasesDisposed ?? "—",
      },
    ],
  },
];
