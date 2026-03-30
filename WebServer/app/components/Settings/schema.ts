import {
  BackupFrequency,
  LockoutThreshold,
  LogRetention,
  PasswordExpiration,
  SessionTimeout,
} from "@/app/generated/prisma/enums";
import { z } from "zod";

export const SystemSettingsSchema = z.object({
  maintainanceMode: z.boolean(),
  systemAnnouncement: z.string().nullable(),
  smtpHost: z.string().nullable(),
  smtpPort: z.number().int().min(1).max(65535).nullable(),
  senderName: z.string().nullable(),
  senderEmail: z.string().nullable(),
  senderPassword: z.string().nullable(),
  backupFrequency: z.enum(BackupFrequency),
  logRetention: z.enum(LogRetention),
  passwordExpiration: z.enum(PasswordExpiration),
  lockoutThreshold: z.enum(LockoutThreshold),
  sessionTimeout: z.enum(SessionTimeout),
});

export type SystemSettingsSchema = z.infer<typeof SystemSettingsSchema>;

export const defaultSystemSettings: SystemSettingsSchema = {
  maintainanceMode: false,
  systemAnnouncement: null,
  smtpHost: null,
  smtpPort: null,
  senderName: null,
  senderEmail: null,
  senderPassword: null,
  backupFrequency: BackupFrequency.MANUAL,
  logRetention: LogRetention.THREE_MONTHS,
  passwordExpiration: PasswordExpiration.NEVER,
  lockoutThreshold: LockoutThreshold.NONE,
  sessionTimeout: SessionTimeout.NEVER,
};
