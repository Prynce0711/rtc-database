export type CivilTransmittalKind = "cif" | "transmittal";

export type RecordField<T extends string = string> = {
  key: T;
  label: string;
  type: "text" | "date" | "textarea";
};

export type CivilCifTransmittalRecordData = {
  id: number;
  caseNumber: string | null;
  branchJudge: string | null;
  date: string | null;
  plaintiffs: string | null;
  defendants: string | null;
  status: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type CivilCifTransmittalInput = Omit<
  CivilCifTransmittalRecordData,
  "id" | "createdAt" | "updatedAt"
>;

export type CivilTransmittalRecordData = {
  id: number;
  caseNumber: string | null;
  transmittedRaffledToBranch: string | null;
  dateReceived: string | null;
  petitioners: string | null;
  defendants: string | null;
  issuedTransmittedByBranch: string | null;
  toBeRaffledOn: string | null;
  natureOfTransmittal: string | null;
  orderResolutionDated: string | null;
  attorney1: string | null;
  officeAddress1: string | null;
  attorney2: string | null;
  officeAddress2: string | null;
  attorney3: string | null;
  officeAddress3: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type CivilTransmittalInput = Omit<
  CivilTransmittalRecordData,
  "id" | "createdAt" | "updatedAt"
>;

export const CIVIL_CIF_TRANSMITTAL_FIELDS = [
  { key: "caseNumber", label: "CASE NUMBER", type: "text" },
  { key: "branchJudge", label: "BRANCH / JUDGE", type: "text" },
  { key: "date", label: "DATE", type: "date" },
  { key: "plaintiffs", label: "PLAINTIFF/S", type: "textarea" },
  { key: "defendants", label: "DEFENDANT/S", type: "textarea" },
  { key: "status", label: "STATUS", type: "text" },
  { key: "note", label: "NOTE", type: "textarea" },
] as const satisfies readonly RecordField<keyof CivilCifTransmittalInput & string>[];

export const CIVIL_TRANSMITTAL_RECORD_FIELDS = [
  { key: "caseNumber", label: "CASE NUMBER", type: "text" },
  {
    key: "transmittedRaffledToBranch",
    label: "TRANSMITTED / RAFFLED TO BRANCH",
    type: "text",
  },
  { key: "dateReceived", label: "DATE RECEIVED", type: "date" },
  { key: "petitioners", label: "PETITIONER/S", type: "textarea" },
  { key: "defendants", label: "DEFENDANT/S", type: "textarea" },
  {
    key: "issuedTransmittedByBranch",
    label: "ISSUED / TRANSMITTED BY BRANCH",
    type: "text",
  },
  { key: "toBeRaffledOn", label: "TO BE RAFFLED ON", type: "date" },
  {
    key: "natureOfTransmittal",
    label: "NATURE OF TRANSMITTAL",
    type: "textarea",
  },
  {
    key: "orderResolutionDated",
    label: "ORDER / RESOLUTION DATED",
    type: "date",
  },
  { key: "attorney1", label: "ATTORNEY # 1", type: "text" },
  { key: "officeAddress1", label: "OFFICE ADDRESS # 1", type: "textarea" },
  { key: "attorney2", label: "ATTORNEY # 2", type: "text" },
  { key: "officeAddress2", label: "OFFICE ADDRESS # 2", type: "textarea" },
  { key: "attorney3", label: "ATTORNEY # 3", type: "text" },
  { key: "officeAddress3", label: "OFFICE ADDRESS # 3", type: "textarea" },
] as const satisfies readonly RecordField<keyof CivilTransmittalInput & string>[];
