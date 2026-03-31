import type { CivilCaseData } from "./schema";

export type NotarialRecord = {
  id: number;
  title: string;
  name: string;
  atty: string;
  isManual?: boolean;
  defendant?: string;
  date: string;
  notes?: string;
  nature?: string;
};

export const caseToRecord = (c: CivilCaseData): NotarialRecord => ({
  id: c.id,
  title: c.caseNumber ?? "",
  name: c.branch ?? "",
  atty: c.petitioners ?? "",
  isManual: Boolean(c.isManual),
  defendant: c.defendants ?? "",
  date: c.dateFiled ? new Date(c.dateFiled).toISOString().slice(0, 10) : "",
  notes: c.notes ?? "",
  nature: c.nature ?? "",
});
