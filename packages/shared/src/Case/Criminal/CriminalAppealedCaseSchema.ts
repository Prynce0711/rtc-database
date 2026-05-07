export type CriminalAppealedCaseData = {
  id: number;
  date: string | null;
  referenceToBranch: string | null;
  mtcCaseNo: string | null;
  raffleDate: string | null;
  fromMtcRtcJudge: string | null;
  orderDate: string | null;
  branch: string | null;
  caseNo: string | null;
  dateFiled: string | null;
  accused: string | null;
  charge: string | null;
  ao: string | null;
  appealedId: string | null;
  name1: string | null;
  address1: string | null;
  name2: string | null;
  address2: string | null;
  name3: string | null;
  address3: string | null;
  name4: string | null;
  address4: string | null;
  name5: string | null;
  address5: string | null;
  name6: string | null;
  address6: string | null;
  name7: string | null;
  address7: string | null;
  name8: string | null;
  address8: string | null;
  name9: string | null;
  address9: string | null;
  name10: string | null;
  address10: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type CriminalAppealedCaseInput = Omit<
  CriminalAppealedCaseData,
  "id" | "createdAt" | "updatedAt"
>;

export type CriminalAppealedCaseField = {
  key: keyof CriminalAppealedCaseInput;
  label: string;
  type: "text" | "date";
};

export const CRIMINAL_APPEALED_CASE_FIELDS = [
  { key: "date", label: "DATE", type: "date" },
  { key: "referenceToBranch", label: "REFERENCE TO BRANCH", type: "text" },
  { key: "mtcCaseNo", label: "MTC CASE NO", type: "text" },
  { key: "raffleDate", label: "RAFFLE DATE", type: "date" },
  { key: "fromMtcRtcJudge", label: "FROM MTC/RTC JUDGE", type: "text" },
  { key: "orderDate", label: "ORDER DATE", type: "date" },
  { key: "branch", label: "BRANCH", type: "text" },
  { key: "caseNo", label: "CASE NO", type: "text" },
  { key: "dateFiled", label: "DATE FILED", type: "date" },
  { key: "accused", label: "ACCUSED", type: "text" },
  { key: "charge", label: "CHARGE", type: "text" },
  { key: "ao", label: "AO", type: "text" },
  { key: "appealedId", label: "ID", type: "text" },
  { key: "name1", label: "NAME 1", type: "text" },
  { key: "address1", label: "ADDRESS 1", type: "text" },
  { key: "name2", label: "NAME 2", type: "text" },
  { key: "address2", label: "ADDRESS 2", type: "text" },
  { key: "name3", label: "NAME 3", type: "text" },
  { key: "address3", label: "ADDRESS 3", type: "text" },
  { key: "name4", label: "NAME 4", type: "text" },
  { key: "address4", label: "ADDRESS 4", type: "text" },
  { key: "name5", label: "NAME 5", type: "text" },
  { key: "address5", label: "ADDRESS 5", type: "text" },
  { key: "name6", label: "NAME 6", type: "text" },
  { key: "address6", label: "ADDRESS 6", type: "text" },
  { key: "name7", label: "NAME 7", type: "text" },
  { key: "address7", label: "ADDRESS 7", type: "text" },
  { key: "name8", label: "NAME 8", type: "text" },
  { key: "address8", label: "ADDRESS 8", type: "text" },
  { key: "name9", label: "NAME 9", type: "text" },
  { key: "address9", label: "ADDRESS 9", type: "text" },
  { key: "name10", label: "NAME 10", type: "text" },
  { key: "address10", label: "ADDRESS 10", type: "text" },
] as const satisfies readonly CriminalAppealedCaseField[];
