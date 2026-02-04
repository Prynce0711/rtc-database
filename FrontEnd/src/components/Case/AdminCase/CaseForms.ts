export interface CaseFormData {
  branch: string;
  assistantBranch: string;
  caseNumber: string;
  dateFiled: Date;
  name: string;
  charge: string;
  infoSheet: string;
  court: string;
  detained: boolean;
  consolidation: string;
  eqcNumber?: number;
  bond: number;
  raffleDate?: Date;
  committe1?: number;
  committe2?: number;
}

export const initialCaseFormData: CaseFormData = {
  branch: "",
  assistantBranch: "",
  caseNumber: "",
  dateFiled: new Date(),
  name: "",
  charge: "",
  infoSheet: "",
  court: "",
  detained: false,
  consolidation: "",
  eqcNumber: undefined,
  bond: 0,
  raffleDate: undefined,
  committe1: undefined,
  committe2: undefined,
};

export const validateCaseForm = (
  data: CaseFormData,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.branch.trim()) errors.branch = "Branch is required";
  if (!data.assistantBranch.trim())
    errors.assistantBranch = "Assistant Branch is required";
  if (!data.caseNumber.trim()) errors.caseNumber = "Case Number is required";
  if (!data.name.trim()) errors.name = "Name is required";
  if (!data.charge.trim()) errors.charge = "Charge is required";
  if (!data.infoSheet.trim()) errors.infoSheet = "Info Sheet is required";
  if (!data.court.trim()) errors.court = "Court is required";
  if (!data.consolidation.trim())
    errors.consolidation = "Consolidation is required";
  if (data.bond < 0) errors.bond = "Bond cannot be negative";

  return errors;
};
