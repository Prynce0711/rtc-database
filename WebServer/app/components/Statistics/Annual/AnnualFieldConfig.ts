export interface FieldConfig {
  name: string;
  label: string;
  type: "text" | "date" | "time" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export const courtLogFields: FieldConfig[] = [
  {
    name: "branch",
    label: "Branch",
    type: "text",
    required: true,
    placeholder: "e.g. Branch 1",
  },
  {
    name: "dateRecorded",
    label: "Date",
    type: "date",
    required: true,
  },
  {
    name: "pendingLastYear",
    label: "Pending Last Year",
    type: "text",
    placeholder: "0",
  },
  {
    name: "RaffledOrAdded",
    label: "Raffled / Added",
    type: "text",
    placeholder: "0",
  },
  {
    name: "Disposed",
    label: "Disposed",
    type: "text",
    placeholder: "0",
  },
  {
    name: "pendingThisYear",
    label: "Pending Year Now",
    type: "text",
    placeholder: "0",
  },
  {
    name: "percentageOfDisposition",
    label: "Percentage of Disposition",
    type: "text",
    placeholder: "e.g. 75.5",
  },
];

export const inventoryLogFields: FieldConfig[] = [
  {
    name: "region",
    label: "Region",
    type: "text",
    placeholder: "e.g. Region VII",
  },
  {
    name: "province",
    label: "Province",
    type: "text",
    placeholder: "e.g. Cebu",
  },
  {
    name: "court",
    label: "Court",
    type: "text",
    placeholder: "e.g. MTC Branch 1",
  },
  {
    name: "cityMunicipality",
    label: "City/Municipality",
    type: "text",
    placeholder: "e.g. Cebu City",
  },
  {
    name: "branch",
    label: "Branch",
    type: "text",
    required: true,
    placeholder: "e.g. Branch 1",
  },
  {
    name: "dateRecorded",
    label: "Date Recorded",
    type: "date",
    required: true,
  },
  {
    name: "civilSmallClaimsFiled",
    label: "Cases Filed – Civil / Small Claims",
    type: "text",
    placeholder: "0",
  },
  {
    name: "criminalCasesFiled",
    label: "Cases Filed – Criminal",
    type: "text",
    placeholder: "0",
  },
  {
    name: "civilSmallClaimsDisposed",
    label: "Cases Disposed – Civil / Small Claims",
    type: "text",
    placeholder: "0",
  },
  {
    name: "criminalCasesDisposed",
    label: "Cases Disposed – Criminal",
    type: "text",
    placeholder: "0",
  },
];
