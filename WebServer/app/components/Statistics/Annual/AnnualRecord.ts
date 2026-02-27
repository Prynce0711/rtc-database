export interface CourtLog {
  id: number;
  branch?: string | null;
  notes?: string | null;
  pendingLastYear?: string | number | null;
  RaffledOrAdded?: string | number | null;
  Disposed?: string | number | null;
  pendingThisYear?: string | number | null;
  percentageOfDisposition?: string | number | null;
}

export interface InventoryLog {
  id: number;
  region?: string | null;
  province?: string | null;
  court?: string | null;
  cityMunicipality?: string | null;
  branch?: string | null;
  civilSmallClaimsFiled?: string | number | null;
  criminalCasesFiled?: string | number | null;
  civilSmallClaimsDisposed?: string | number | null;
  criminalCasesDisposed?: string | number | null;
  dateRecorded: Date | string;
}

export type AnnualTableVariant = "MTC" | "RTC" | "Inventory";
