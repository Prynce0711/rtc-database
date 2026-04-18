import type ActionResult from "../ActionResult";
import type { CriminalCaseData } from "../Case/Criminal/CriminalCaseSchema";

export type UpsertSingleCriminalCasePayload = {
  source: "webserver";
  sentAt: string;
  caseData: CriminalCaseData;
};

export type UpsertSingleCriminalCaseResult = {
  caseId: number;
  caseNumber: string;
  syncedAt: string;
};

export type UpsertSingleCriminalCaseResponse =
  ActionResult<UpsertSingleCriminalCaseResult>;
