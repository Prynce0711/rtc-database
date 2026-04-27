"use client";

import type { PetitionCaseAdapter } from "@rtc-database/shared";
import {
  exportPetitionTransmittalsExcel,
  getPetitionTransmittals,
  getPetitionTransmittalStats,
} from "./PetitionTransmittalActions";

type PetitionCaseTransmittalAdapter = Pick<
  PetitionCaseAdapter,
  "getPetitions" | "getPetitionStats" | "exportPetitionsExcel"
>;

export const petitionCaseTransmittalAdapter: PetitionCaseTransmittalAdapter = {
  getPetitions: getPetitionTransmittals,
  getPetitionStats: getPetitionTransmittalStats,
  exportPetitionsExcel: exportPetitionTransmittalsExcel,
};

export default petitionCaseTransmittalAdapter;
