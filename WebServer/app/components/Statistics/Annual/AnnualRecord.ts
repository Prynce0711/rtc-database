// Base record type shared by all Annual table variants
export interface CourtLog {
  id: number;
  bookAndPages: string;
  dateRecorded: Date | string;
  timeRecorded?: string | null;
  abbreviation?: string | null;
  caseNumber: string;
  content?: string | null;
  party?: string | null;
  receivedBy?: string | null;
  branchNumber?: string | null;
  notes?: string | null;
  // MTC / RTC annual stats fields
  pendingLastYear?: string | number | null;
  RaffledOrAdded?: string | number | null;
  Disposed?: string | number | null;
  pendingThisYear?: string | number | null;
  percentageOfDisposition?: string | number | null;
}

export interface InventoryLog {
  id: number;
  Region?: string | null;
  province?: string | null;
  Court?: string | null;
  CityMunicipality?: string | null;
  Branch?: string | null;
  // CASES FILED
  civilSmallClaimsFiled?: string | number | null;
  criminalCasesFiled?: string | number | null;
  // CASES DISPOSED
  civilSmallClaimsDisposed?: string | number | null;
  criminalCasesDisposed?: string | number | null;
  dateRecorded: Date | string;
}

export type AnnualTableVariant = "MTC" | "RTC" | "Inventory";
