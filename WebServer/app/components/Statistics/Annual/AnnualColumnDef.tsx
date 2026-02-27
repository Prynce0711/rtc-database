import React from "react";
import { CourtLog, InventoryLog } from "./AnnualRecord";

const asCourt = (r: Record<string, unknown>) => r as unknown as CourtLog;
const asInventory = (r: Record<string, unknown>) =>
  r as unknown as InventoryLog;

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render: (row: Record<string, unknown>) => React.ReactNode;
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

export const courtColumns: ColumnDef[] = [
  {
    key: "branch",
    label: "Branch",
    sortable: true,
    align: "center",
    render: (r) => asCourt(r).branch || "—",
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

export const inventoryColumns: AnyColumnDef[] = [
  {
    key: "region",
    label: "Region",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).region || "—",
  },
  {
    key: "province",
    label: "Province",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).province || "—",
  },
  {
    key: "court",
    label: "Court",
    sortable: false,
    align: "center",
    render: (r) => asInventory(r).court || "—",
  },
  {
    key: "cityMunicipality",
    label: "City/Municipality",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).cityMunicipality || "—",
  },
  {
    key: "branch",
    label: "Branch",
    sortable: true,
    align: "center",
    render: (r) => asInventory(r).branch || "—",
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
