import type { SheriffCaseData } from "./schema";

export type SheriffRecord = {
  id: number;
  title: string;
  mortgagee?: string;
  mortgagor?: string;
  sheriffName?: string;
  isManual?: boolean;
  date: string;
  remarks?: string;
};

export const caseToRecord = (c: SheriffCaseData): SheriffRecord => ({
  id: c.id,
  title: c.caseNumber ?? "",
  mortgagee: c.mortgagee ?? "",
  mortgagor: c.mortgagor ?? "",
  sheriffName: c.sheriffName ?? "",
  isManual: Boolean(c.isManual),
  date: c.dateFiled ? new Date(c.dateFiled).toISOString().slice(0, 10) : "",
  remarks: c.remarks ?? "",
});
