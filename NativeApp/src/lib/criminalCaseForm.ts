import type { CriminalCaseData } from "@rtc-database/shared";
import { createTempId } from "@rtc-database/shared/src/utils";

export type CaseEntry = {
  id: number;
  isManual: boolean;
  errors: Record<string, string>;
  collapsed: boolean;
  saved: boolean;
  branch: string | null;
  assistantBranch: string | null;
  caseNumber: string;
  dateFiled: Date | null;
  caseType: "CRIMINAL";
  name: string;
  charge: string | null;
  infoSheet: string | null;
  court: string | null;
  detained: string | null;
  consolidation: string | null;
  eqcNumber: string | null;
  bond: string | null;
  raffleDate: Date | null;
  committee1: string | null;
  committee2: string | null;
  judge: string | null;
  ao: string | null;
  complainant: string | null;
  houseNo: string | null;
  street: string | null;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  counts: string | null;
  jdf: string | null;
  sajj: string | null;
  sajj2: string | null;
  mf: string | null;
  stf: string | null;
  lrf: string | null;
  vcf: string | null;
  total: string | null;
  amountInvolved: string | null;
};

export const createEmptyEntry = (): CaseEntry => ({
  id: createTempId(),
  isManual: false,
  errors: {},
  collapsed: false,
  saved: false,
  branch: null,
  assistantBranch: null,
  caseNumber: "",
  dateFiled: new Date(),
  caseType: "CRIMINAL",
  name: "",
  charge: null,
  infoSheet: null,
  court: null,
  detained: null,
  consolidation: null,
  eqcNumber: null,
  bond: null,
  raffleDate: null,
  committee1: null,
  committee2: null,
  judge: null,
  ao: null,
  complainant: null,
  houseNo: null,
  street: null,
  barangay: null,
  municipality: null,
  province: null,
  counts: null,
  jdf: null,
  sajj: null,
  sajj2: null,
  mf: null,
  stf: null,
  lrf: null,
  vcf: null,
  total: null,
  amountInvolved: null,
});

export const caseToEntry = (c: CriminalCaseData): CaseEntry => ({
  ...createEmptyEntry(),
  ...c,
  dateFiled: c.dateFiled ? new Date(c.dateFiled) : null,
  raffleDate: c.raffleDate ? new Date(c.raffleDate) : null,
  id: c.id ?? createTempId(),
  isManual: Boolean(c.isManual),
  caseType: "CRIMINAL",
  errors: {},
  collapsed: false,
  saved: false,
});
