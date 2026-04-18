import z from "zod";

export const deviceID = z.uuidv4();
export type DeviceID = z.infer<typeof deviceID>;

export const lastSyncedAt = z.coerce.date();
export type LastSyncedAt = z.infer<typeof lastSyncedAt>;

export const UpdateSyncStatePayload = z.object({
  deviceId: deviceID,
  lastSyncedAt: lastSyncedAt,
});

export type UpdateSyncStatePayload = z.infer<typeof UpdateSyncStatePayload>;
