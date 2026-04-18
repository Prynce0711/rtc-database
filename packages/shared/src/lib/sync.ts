import z from "zod";
import type ActionResult from "../ActionResult";
import type { CriminalCaseData } from "../Case/Criminal/CriminalCaseSchema";

export const deviceID = z.uuidv4();
export type DeviceID = z.infer<typeof deviceID>;

export const lastSyncedAt = z.coerce.date();
export type LastSyncedAt = z.infer<typeof lastSyncedAt>;

export const UpdateSyncStatePayload = z.object({
  deviceId: deviceID,
  lastSyncedAt,
});

export type UpdateSyncStatePayload = z.infer<typeof UpdateSyncStatePayload>;

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
