import { MTCJudgementLog, RTCJudgementLog } from "./JudgementRecord";

/** A leaf column: renders a single cell in a data row */
export interface LeafColumn {
  key: string;
  render: (row: Record<string, unknown>) => React.ReactNode;
}

const v = (row: Record<string, unknown>, key: string): React.ReactNode =>
  (row[key] as string | number | null | undefined) ?? "—";

/** MTC leaf columns — order matches the header rows defined in JudgementMTC */
export const mtcLeafColumns: LeafColumn[] = [
  { key: "branchNo", render: (r) => v(r, "branchNo") },
  { key: "civilV", render: (r) => v(r, "civilV") },
  { key: "civilInC", render: (r) => v(r, "civilInC") },
  { key: "criminalV", render: (r) => v(r, "criminalV") },
  { key: "criminalInC", render: (r) => v(r, "criminalInC") },
  { key: "totalHeard", render: (r) => v(r, "totalHeard") },
  { key: "disposedCivil", render: (r) => v(r, "disposedCivil") },
  { key: "disposedCrim", render: (r) => v(r, "disposedCrim") },
  { key: "totalDisposed", render: (r) => v(r, "totalDisposed") },
  { key: "pdlM", render: (r) => v(r, "pdlM") },
  { key: "pdlF", render: (r) => v(r, "pdlF") },
  { key: "pdlTotal", render: (r) => v(r, "pdlTotal") },
  { key: "pdlV", render: (r) => v(r, "pdlV") },
  { key: "pdlI", render: (r) => v(r, "pdlI") },
  { key: "pdlBail", render: (r) => v(r, "pdlBail") },
  { key: "pdlRecognizance", render: (r) => v(r, "pdlRecognizance") },
  { key: "pdlMinRor", render: (r) => v(r, "pdlMinRor") },
  { key: "pdlMaxSentence", render: (r) => v(r, "pdlMaxSentence") },
  { key: "pdlDismissal", render: (r) => v(r, "pdlDismissal") },
  { key: "pdlAcquittal", render: (r) => v(r, "pdlAcquittal") },
  { key: "pdlMinSentence", render: (r) => v(r, "pdlMinSentence") },
  { key: "pdlOthers", render: (r) => v(r, "pdlOthers") },
  { key: "total", render: (r) => v(r, "total") },
];

/** RTC leaf columns — order matches the header rows defined in JudgementRTC */
export const rtcLeafColumns: LeafColumn[] = [
  { key: "branchNo", render: (r) => v(r, "branchNo") },
  { key: "civilV", render: (r) => v(r, "civilV") },
  { key: "civilInC", render: (r) => v(r, "civilInC") },
  { key: "criminalV", render: (r) => v(r, "criminalV") },
  { key: "criminalInC", render: (r) => v(r, "criminalInC") },
  { key: "totalHeard", render: (r) => v(r, "totalHeard") },
  { key: "disposedCivil", render: (r) => v(r, "disposedCivil") },
  { key: "disposedCrim", render: (r) => v(r, "disposedCrim") },
  { key: "summaryProc", render: (r) => v(r, "summaryProc") },
  { key: "casesDisposed", render: (r) => v(r, "casesDisposed") },
  { key: "pdlM", render: (r) => v(r, "pdlM") },
  { key: "pdlF", render: (r) => v(r, "pdlF") },
  { key: "pdlCICL", render: (r) => v(r, "pdlCICL") },
  { key: "pdlTotal", render: (r) => v(r, "pdlTotal") },
  { key: "pdlV", render: (r) => v(r, "pdlV") },
  { key: "pdlInC", render: (r) => v(r, "pdlInC") },
  { key: "pdlBail", render: (r) => v(r, "pdlBail") },
  { key: "pdlRecognizance", render: (r) => v(r, "pdlRecognizance") },
  { key: "pdlMinRor", render: (r) => v(r, "pdlMinRor") },
  { key: "pdlMaxSentence", render: (r) => v(r, "pdlMaxSentence") },
  { key: "pdlDismissal", render: (r) => v(r, "pdlDismissal") },
  { key: "pdlAcquittal", render: (r) => v(r, "pdlAcquittal") },
  { key: "pdlMinSentence", render: (r) => v(r, "pdlMinSentence") },
  { key: "pdlProbation", render: (r) => v(r, "pdlProbation") },
  { key: "ciclM", render: (r) => v(r, "ciclM") },
  { key: "ciclF", render: (r) => v(r, "ciclF") },
  { key: "ciclV", render: (r) => v(r, "ciclV") },
  { key: "ciclInC", render: (r) => v(r, "ciclInC") },
  { key: "fine", render: (r) => v(r, "fine") },
  { key: "total", render: (r) => v(r, "total") },
];

export type { MTCJudgementLog, RTCJudgementLog };

