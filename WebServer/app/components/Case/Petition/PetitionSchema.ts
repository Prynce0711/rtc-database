import { z } from "zod";

// Document type options — add values here once available
export const DOC_TYPES: string[] = [];

export const PetitionLogSchema = z.object({
  id: z.number().int().optional(),
  receiptNo: z.string().min(1, "Receipt No. is required"),
  dateReceived: z.union([
    z.date(),
    z.string().transform((val) => new Date(val)),
  ]),
  timeReceived: z.string().optional(),
  caseNumber: z.string().min(1, "Case number is required"),
  documentType: z.string().min(1, "Document type is required"),
  party: z.string().min(1, "Party / Title is required"),
  receivedBy: z.string().min(1, "Received By is required"),
  branch: z.string().min(1, "Branch is required"),
  remarks: z.string().optional(),
});

export const ReceiveLogSchema = PetitionLogSchema;

export type PetitionLogSchema = z.infer<typeof PetitionLogSchema>;
export type ReceiveLogSchema = PetitionLogSchema;

export const initialReceiveLogFormData: PetitionLogSchema = {
  receiptNo: "",
  dateReceived: new Date(),
  timeReceived: "",
  caseNumber: "",
  documentType: "",
  party: "",
  receivedBy: "",
  branch: "",
  remarks: "",
};
