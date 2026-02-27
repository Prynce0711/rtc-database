import type { FieldConfig } from "../Annual/AnnualFieldConfig";

export const judgementFields: FieldConfig[] = [
  {
    name: "branchNo",
    label: "Branch No.",
    type: "text",
    required: true,
    placeholder: "e.g. 1",
  },
  { name: "dateRecorded", label: "Date", type: "date", required: true },
  { name: "civilV", label: "Civil V", type: "text", placeholder: "0" },
  { name: "civilInC", label: "Civil In-C", type: "text", placeholder: "0" },
  { name: "criminalV", label: "Criminal V", type: "text", placeholder: "0" },
  {
    name: "criminalInC",
    label: "Criminal In-C",
    type: "text",
    placeholder: "0",
  },
  { name: "totalHeard", label: "Total Heard", type: "text", placeholder: "0" },
  {
    name: "disposedCivil",
    label: "Disposed (Civil)",
    type: "text",
    placeholder: "0",
  },
  {
    name: "disposedCrim",
    label: "Disposed (Crim)",
    type: "text",
    placeholder: "0",
  },
  {
    name: "summaryProc",
    label: "Summary Proc",
    type: "text",
    placeholder: "0",
  },
  {
    name: "totalDisposed",
    label: "Total Disposed",
    type: "text",
    placeholder: "0",
  },
  { name: "PDL_M", label: "PDL M", type: "text", placeholder: "0" },
  { name: "PDL_F", label: "PDL F", type: "text", placeholder: "0" },
  { name: "PDL_CICL", label: "PDL CICL", type: "text", placeholder: "0" },
  { name: "fine", label: "Fine", type: "text", placeholder: "0" },
];

export default judgementFields;
