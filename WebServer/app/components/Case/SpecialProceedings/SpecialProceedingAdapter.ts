"use client";

import type { SpecialProceedingAdapter } from "@rtc-database/shared";
import { doesCaseExist, getCases, getCaseStats } from "../BaseCaseActions";
import {
  exportSpecialProceedingsExcel,
  uploadSpecialProceedingExcel,
} from "./ExcelActions";
import {
  createSpecialProceeding,
  deleteSpecialProceeding,
  getSpecialProceedingByCaseNumber,
  getSpecialProceedingById,
  getSpecialProceedingCaseNumberPreview,
  getSpecialProceedings,
  getSpecialProceedingsByCaseNumbers,
  getSpecialProceedingsByIds,
  getSpecialProceedingStats,
  updateSpecialProceeding,
} from "./SpecialProceedingActions";

export const specialProceedingAdapter: SpecialProceedingAdapter = {
  doesCaseExist,
  getCases,
  getCaseStats,
  getSpecialProceedings,
  getSpecialProceedingStats,
  createSpecialProceeding,
  getSpecialProceedingCaseNumberPreview,
  updateSpecialProceeding,
  deleteSpecialProceeding,
  getSpecialProceedingById,
  getSpecialProceedingsByIds,
  getSpecialProceedingsByCaseNumbers,
  getSpecialProceedingByCaseNumber,
  uploadSpecialProceedingExcel,
  exportSpecialProceedingsExcel,
};

export default specialProceedingAdapter;
