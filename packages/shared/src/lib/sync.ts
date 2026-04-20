import z from "zod";
import type ActionResult from "../ActionResult";
import type { Case, CriminalCase } from "../generated/prisma/browser";

export const BATCH_SIZE = 100000;

export const deviceID = z.uuidv4();
export type DeviceID = z.infer<typeof deviceID>;

export const lastSyncedAt = z.coerce.date();
export type LastSyncedAt = z.infer<typeof lastSyncedAt>;

export const UpdateSyncStatePayload = z.object({
  deviceId: deviceID,
  lastSyncedAt,
});

export type UpdateSyncStatePayload = z.infer<typeof UpdateSyncStatePayload>;

export type UpsertCriminalCasesPayload = {
  source: "webserver";
  sentAt: string;
  casesData: { case: Case; criminalCase: CriminalCase }[];
};

export type UpsertCriminalCasesResult = {
  syncedCount: number;
  syncedAt: string;
};

export type UpsertCriminalCasesResponse =
  ActionResult<UpsertCriminalCasesResult>;

export const CursorData = z.object({
  syncStart: z.coerce.date(),
  fromUpdatedAt: z.coerce.date().optional(),
  cursor: z
    .object({
      updatedAt: z.coerce.date(),
      id: z.number().int().positive(),
    })
    .optional(),
});
export type CursorData = z.infer<typeof CursorData>;
