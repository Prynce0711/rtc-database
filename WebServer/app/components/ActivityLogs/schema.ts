import { LogAction } from "@rtc-database/shared/prisma/enums";
import Roles from "@/app/lib/Roles";
import {
  CivilCaseSchema,
  CriminalCaseSchema,
  PetitionCaseSchema,
  ReceivingLogSchema,
  SheriffCaseSchema,
  SpecialProceedingSchema,
} from "@rtc-database/shared";
import { z } from "zod";
import { NotarialSchema } from "../Case/Notarial/schema";
import { EmployeeSchema } from "../Employee/schema";

function createUpdateSchema<T>(schema: z.ZodType<T>) {
  return z.object({
    from: schema,
    to: schema,
  });
}

const LogDetails = z.record(z.string(), z.unknown()).nullable();

const ResourceLogAction = z.enum([
  LogAction.UPDATE_STATUS,
  LogAction.UPDATE_TUTORIAL,
  LogAction.UPDATE_SYSTEM_SETTINGS,
  LogAction.UPDATE_BACKUP_SETTINGS,
  LogAction.RUN_BACKUP,
  LogAction.RESTORE_BACKUP,
  LogAction.CREATE_BACKUP_ACCOUNT,
  LogAction.UPDATE_BACKUP_ACCOUNT,
  LogAction.DELETE_BACKUP_ACCOUNT,
  LogAction.CREATE_NOTARIAL,
  LogAction.UPDATE_NOTARIAL,
  LogAction.DELETE_NOTARIAL,
  LogAction.CREATE_NOTARIAL_COMMISSION,
  LogAction.UPDATE_NOTARIAL_COMMISSION,
  LogAction.DELETE_NOTARIAL_COMMISSION,
  LogAction.IMPORT_NOTARIAL_COMMISSION,
  LogAction.EXPORT_NOTARIAL_COMMISSION,
  LogAction.CREATE_STATISTICS,
  LogAction.UPDATE_STATISTICS,
  LogAction.DELETE_STATISTICS,
  LogAction.IMPORT_STATISTICS,
  LogAction.EXPORT_STATISTICS,
  LogAction.CLEAR_STATISTICS,
  LogAction.UPLOAD_FILE,
  LogAction.UPDATE_FILE,
  LogAction.DELETE_FILE,
  LogAction.MOVE_FILE,
  LogAction.RENAME_FILE,
  LogAction.CREATE_FOLDER,
  LogAction.CREATE_CHAT,
  LogAction.DELETE_CHAT,
  LogAction.LEAVE_CHAT,
  LogAction.SEND_MESSAGE,
  LogAction.DELETE_MESSAGE,
  LogAction.UPDATE_SYNC_STATE,
  LogAction.RESET_SYNC_STATE,
] as const);

export const CreateLogData = z
  .object({
    action: z
      .literal(LogAction.CREATE_CASE)
      .or(z.literal(LogAction.DELETE_CASE))
      .or(z.literal(LogAction.CREATE_EMPLOYEE))
      .or(z.literal(LogAction.DELETE_EMPLOYEE)),
    details: z.object({
      id: z.number(),
    }),
  })
  .or(
    z.object({
      action: z
        .literal(LogAction.CREATE_USER)
        .or(z.literal(LogAction.DEACTIVATE_USER))
        .or(z.literal(LogAction.REACTIVATE_USER))
        .or(z.literal(LogAction.LOGIN_SUCCESS)),
      details: z.object({
        id: z.string(),
      }),
    }),
  )
  .or(
    z.object({
      action: z.literal(LogAction.UPDATE_ROLE),
      details: z.object({
        userId: z.string(),
        from: z.enum(Roles),
        to: z.enum(Roles),
      }),
    }),
  )
  .or(
    z.object({
      action: z.literal(LogAction.UPDATE_CASE),
      details: createUpdateSchema(CriminalCaseSchema)
        .or(createUpdateSchema(CivilCaseSchema))
        .or(createUpdateSchema(PetitionCaseSchema))
        .or(createUpdateSchema(SpecialProceedingSchema))
        .or(createUpdateSchema(ReceivingLogSchema))
        .or(createUpdateSchema(NotarialSchema))
        .or(createUpdateSchema(SheriffCaseSchema)),
    }),
  )
  .or(
    z.object({
      action: z.literal(LogAction.UPDATE_EMPLOYEE),
      details: z.object({
        from: EmployeeSchema,
        to: EmployeeSchema,
      }),
    }),
  )
  .or(
    z.object({
      // For login/logout actions, we can just log the user ID without needing "from" and "to" states
      // This also covers CREATE_USER, DEACTIVATE_USER, REACTIVATE_USER, EXPORT_CASES, and EXPORT_EMPLOYEES actions
      action: z.literal(LogAction.LOGIN_FAILED),
      details: z.object({
        email: z.email(),
      }),
    }),
  )
  .or(
    z.object({
      action: z
        .literal(LogAction.IMPORT_CASES)
        .or(z.literal(LogAction.IMPORT_EMPLOYEES)),
      details: z.object({
        ids: z.array(z.number()),
      }),
    }),
  )
  .or(
    z.object({
      action: z
        .literal(LogAction.LOGOUT)
        .or(z.literal(LogAction.EXPORT_CASES))
        .or(z.literal(LogAction.EXPORT_EMPLOYEES)),
      details: z.null(),
    }),
  )
  .or(
    z.object({
      action: z
        .literal(LogAction.CHANGE_PASSWORD)
        .or(z.literal(LogAction.SET_INITIAL_PASSWORD))
        .or(z.literal(LogAction.RESET_PASSWORD)),
      details: z.object({
        id: z.string(),
      }),
    }),
  )
  .or(
    z.object({
      action: z.literal(LogAction.SEND_MAGIC_LINK),
      details: z.object({
        email: z.string(),
      }),
    }),
  )
  .or(
    z.object({
      action: z
        .literal(LogAction.UPDATE_PROFILE)
        .or(z.literal(LogAction.DELETE_USER)),
      details: z.object({
        id: z.string(),
      }),
    }),
  )
  .or(
    z.object({
      action: ResourceLogAction,
      details: LogDetails,
    }),
  );
export type CreateLogData = z.infer<typeof CreateLogData>;

export const BaseLogData = z.object({
  id: z.number(),
  timestamp: z.date(),
  userId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      role: z.string(),
    })
    .nullable(),
});
export type BaseLogData = z.infer<typeof BaseLogData>;

export const CompleteLogData = BaseLogData.and(CreateLogData);
export type CompleteLogData = z.infer<typeof CompleteLogData>;
