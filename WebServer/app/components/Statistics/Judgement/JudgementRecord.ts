// Record type for Judgment Day table
export interface JudgementLog {
  id: number;
  branchNo?: string | null;
  dateRecorded: Date | string;
  // Number of cases heard/tried
  civilV?: number | string | null;
  civilInC?: number | string | null;
  criminalV?: number | string | null;
  criminalInC?: number | string | null;
  totalHeard?: number | string | null;
  // Number of cases disposed
  disposedCivil?: number | string | null;
  disposedCrim?: number | string | null;
  summaryProc?: number | string | null;
  totalDisposed?: number | string | null;
  // PDL / CICL / other outcome breakdowns (optional)
  PDL_M?: number | string | null;
  PDL_F?: number | string | null;
  PDL_CICL?: number | string | null;
  PDL_Total?: number | string | null;
  CICL_M?: number | string | null;
  CICL_F?: number | string | null;
  CICL_V?: number | string | null;
  CICL_InC?: number | string | null;
  fine?: number | string | null;
}
