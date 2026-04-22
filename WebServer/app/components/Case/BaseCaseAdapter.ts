"use client";

import type { BaseCaseAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "./BaseCaseActions";

export const baseCaseAdapter: BaseCaseAdapter = {
  doesCaseExist,
  getCases,
  getCaseStats,
};

export default baseCaseAdapter;
