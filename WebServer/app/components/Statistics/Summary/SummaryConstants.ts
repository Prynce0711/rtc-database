export const SUMMARY_COURT_TYPES = [
  {
    value: "STATUTORY FAMILY COURTS",
    shortLabel: "Statutory Family",
    description: "Statutory Family Courts",
    titleAliases: ["STATUTORY FAMILY COURTS"],
  },
  {
    value: "DESIGNATED FAMILY COURTS",
    shortLabel: "Designated Family",
    description: "Designated Family Courts",
    titleAliases: ["DESIGNATED FAMILY COURTS", "DESIGNATED FAMILY COURS"],
  },
  {
    value: "REGULAR COURTS",
    shortLabel: "Regular Courts",
    description: "Regular Courts",
    titleAliases: ["REGULAR COURTS"],
  },
  {
    value: "STATUTORY COURTS OF SPECIFIC JURISDICTION",
    shortLabel: "Specific Jurisdiction",
    description: "Statutory Courts of Specific Jurisdiction",
    titleAliases: ["STATUTORY COURTS OF SPECIFIC JURISDICTION"],
  },
  {
    value: "COMMERCIAL COURTS",
    shortLabel: "Commercial Courts",
    description: "Commercial Courts",
    titleAliases: ["COMMERCIAL COURTS"],
  },
] as const;

export type SummaryCourtType = (typeof SUMMARY_COURT_TYPES)[number]["value"];

export const SUMMARY_MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
] as const;

const normalizeTitleToken = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();

export const TITLE_ALIAS_LOOKUP = SUMMARY_COURT_TYPES.flatMap((type) =>
  type.titleAliases.map((alias) => ({
    key: normalizeTitleToken(alias),
    courtType: type.value,
  })),
);

export const SUMMARY_NUMERIC_FIELDS = [
  "civilFamily",
  "civilOrdinary",
  "civilReceivedViaReraffled",
  "civilUnloaded",
  "lrcPetition",
  "lrcSpProc",
  "lrcReceivedViaReraffled",
  "lrcUnloaded",
  "criminalFamily",
  "criminalDrugs",
  "criminalOrdinary",
  "criminalReceivedViaReraffled",
  "criminalUnloaded",
  "total",
] as const;
