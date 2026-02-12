import { LogAction } from "@/app/generated/prisma/enums";
import Roles from "@/app/lib/Roles";
import { z } from "zod";
import { CaseSchema } from "../Case/schema";
import { EmployeeSchema } from "../Employee/schema";

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
      details: z.object({
        from: CaseSchema,
        to: CaseSchema,
      }),
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
        userIds: z.array(z.number()),
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
