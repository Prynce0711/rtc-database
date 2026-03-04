export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "date" | "time" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

const commonFields: FieldConfig[] = [
  {
    name: "branchNo",
    label: "Branch No.",
    type: "text",
    required: true,
    placeholder: "e.g. Branch 1",
  },
  { name: "dateRecorded", label: "Date", type: "date", required: true },
  { name: "civilV", label: "Civil – V", type: "text", placeholder: "0" },
  { name: "civilInC", label: "Civil – In-C", type: "text", placeholder: "0" },
  { name: "criminalV", label: "Criminal – V", type: "text", placeholder: "0" },
  {
    name: "criminalInC",
    label: "Criminal – In-C",
    type: "text",
    placeholder: "0",
  },
  {
    name: "totalHeard",
    label: "Total Cases Heard",
    type: "text",
    placeholder: "0",
  },
];

export const mtcJudgementFields: FieldConfig[] = [
  ...commonFields,
  {
    name: "disposedCivil",
    label: "Disposed – Civil",
    type: "text",
    placeholder: "0",
  },
  {
    name: "disposedCrim",
    label: "Disposed – Crim",
    type: "text",
    placeholder: "0",
  },
  {
    name: "totalDisposed",
    label: "Total Cases Disposed",
    type: "text",
    placeholder: "0",
  },
  { name: "pdlM", label: "PDL/CICL – M", type: "text", placeholder: "0" },
  { name: "pdlF", label: "PDL/CICL – F", type: "text", placeholder: "0" },
  {
    name: "pdlTotal",
    label: "PDL/CICL – Total",
    type: "text",
    placeholder: "0",
  },
  { name: "pdlV", label: "PDL Released – V", type: "text", placeholder: "0" },
  { name: "pdlI", label: "PDL Released – I", type: "text", placeholder: "0" },
  {
    name: "pdlBail",
    label: "PDL Released – Bail",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlRecognizance",
    label: "PDL Released – Recognizance",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlMinRor",
    label: "PDL Released – Min/ror",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlMaxSentence",
    label: "PDL Released – Max Sentence",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlDismissal",
    label: "PDL Released – Dismissal",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlAcquittal",
    label: "PDL Released – Acquittal",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlMinSentence",
    label: "PDL Released – Min Sentence",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlOthers",
    label: "PDL Released – Others",
    type: "text",
    placeholder: "0",
  },
  { name: "total", label: "TOTAL", type: "text", placeholder: "0" },
];

export const rtcJudgementFields: FieldConfig[] = [
  ...commonFields,
  {
    name: "disposedCivil",
    label: "Disposed – Civil",
    type: "text",
    placeholder: "0",
  },
  {
    name: "disposedCrim",
    label: "Disposed – Crim",
    type: "text",
    placeholder: "0",
  },
  {
    name: "summaryProc",
    label: "Disposed – Summary Proc",
    type: "text",
    placeholder: "0",
  },
  {
    name: "casesDisposed",
    label: "Total Cases Disposed",
    type: "text",
    placeholder: "0",
  },
  { name: "pdlM", label: "PDL/CICL – M", type: "text", placeholder: "0" },
  { name: "pdlF", label: "PDL/CICL – F", type: "text", placeholder: "0" },
  { name: "pdlCICL", label: "PDL/CICL – CICL", type: "text", placeholder: "0" },
  {
    name: "pdlTotal",
    label: "PDL/CICL – Total",
    type: "text",
    placeholder: "0",
  },
  { name: "pdlV", label: "PDL Released – V", type: "text", placeholder: "0" },
  {
    name: "pdlInC",
    label: "PDL Released – In-C",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlBail",
    label: "PDL Released – Bail",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlRecognizance",
    label: "PDL Released – Recognizance",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlMinRor",
    label: "PDL Released – Min/ror",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlMaxSentence",
    label: "PDL Released – Max Sentence",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlDismissal",
    label: "PDL Released – Dismissal",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlAcquittal",
    label: "PDL Released – Acquittal",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlMinSentence",
    label: "PDL Released – Min Sentence",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pdlProbation",
    label: "PDL Released – Probation",
    type: "text",
    placeholder: "0",
  },
  { name: "ciclM", label: "CICL – M", type: "text", placeholder: "0" },
  { name: "ciclF", label: "CICL – F", type: "text", placeholder: "0" },
  { name: "ciclV", label: "CICL – V", type: "text", placeholder: "0" },
  { name: "ciclInC", label: "CICL – In-C", type: "text", placeholder: "0" },
  { name: "fine", label: "Fine", type: "text", placeholder: "0" },
  { name: "total", label: "TOTAL", type: "text", placeholder: "0" },
];
