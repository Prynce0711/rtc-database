"use server";

import { LogAction, User } from "@/app/generated/prisma/browser";
import { auth } from "@/app/lib/auth";
import { validateSession } from "@/app/lib/authActions";
import { authClient } from "@/app/lib/authClient";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { headers } from "next/dist/server/request/headers";
import { prettifyError } from "zod";
import ActionResult from "../ActionResult";
import { createLog } from "../ActivityLogs/LogActions";
import { NewUserSchema } from "./schema";

export async function getAccounts(): Promise<ActionResult<User[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const users = await prisma.user.findMany();
    return { success: true, result: users };
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return { success: false, error: "Failed to fetch accounts" };
  }
}

export async function createAccount(
  newUser: NewUserSchema,
): Promise<ActionResult<User>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const validation = NewUserSchema.safeParse(newUser);
    if (!validation.success) {
      throw new Error("Invalid user data: " + prettifyError(validation.error));
    }

    const { data: createdUser, error } = await authClient.admin.createUser({
      email: newUser.email, // required
      name: newUser.name, // required
    });

    if (error) {
      throw new Error("Error creating user: " + error.message);
    }

    // better auth does not support arbirary roles when creating users, so we need to update the user after creation
    const updatedUser = await prisma.user.update({
      where: { id: createdUser.user.id },
      data: { role: newUser.role },
    });

    await createLog({
      action: LogAction.CREATE_USER,
      details: {
        id: updatedUser.id,
      },
    });

    return { success: true, result: updatedUser };
  } catch (error) {
    console.error("Error creating account:", error);
    return { success: false, error: "Failed to create account" };
  }
}

export async function changeRole(
  userId: string[],
  newRole: Roles,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userId } },
    });

    await prisma.user.updateMany({
      where: { id: { in: userId } },
      data: { role: newRole },
    });

    for (const user of users) {
      await createLog({
        action: LogAction.UPDATE_ROLE,
        details: {
          userId: user.id,
          from: user.role ? (user.role as Roles) : Roles.USER, // Default to USER if role is null
          to: newRole,
        },
      });
    }

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error changing role:", error);
    return { success: false, error: "Failed to change role" };
  }
}

export async function deactivateAccount(
  userId: string[],
  banReason?: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userId } },
    });

    for (const user of users) {
      await auth.api.banUser({
        body: {
          userId: user.id, // required
          banReason: banReason,
        },
        // This endpoint requires session cookies.
        headers: await headers(),
      });

      await createLog({
        action: LogAction.DEACTIVATE_USER,
        details: {
          id: user.id,
        },
      });
    }

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deactivating account:", error);
    return { success: false, error: "Failed to deactivate account" };
  }
}

export async function unbanAccount(
  userId: string[],
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userId } },
    });

    for (const user of users) {
      await auth.api.unbanUser({
        body: {
          userId: user.id, // required
        },
        // This endpoint requires session cookies.
        headers: await headers(),
      });

      await createLog({
        action: LogAction.REACTIVATE_USER,
        details: {
          id: user.id,
        },
      });
    }
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error unbanning account:", error);
    return { success: false, error: "Failed to unban account" };
  }
}
