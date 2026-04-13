import type ActionResult from "../ActionResult";
import type { PaginatedResult } from "../Filter/FilterTypes";
import type { CaseType } from "../generated/prisma/browser";
import type {
  UnifiedCaseData,
  UnifiedCasesOptions,
  UnifiedCaseStats,
} from "./BaseCaseSchema";

export interface BaseCaseAdapter {
  doesCaseExist: (
    caseNumbers: string[],
    caseType: CaseType,
  ) => Promise<ActionResult<string[]>>;
  getCases: (
    options?: UnifiedCasesOptions,
  ) => Promise<ActionResult<PaginatedResult<UnifiedCaseData>>>;
  getCaseStats: (
    options?: Pick<UnifiedCasesOptions, "caseType">,
  ) => Promise<ActionResult<UnifiedCaseStats>>;
}
