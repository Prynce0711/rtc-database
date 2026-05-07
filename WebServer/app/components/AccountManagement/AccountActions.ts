"use server";

import { LogAction, Status, User } from "@rtc-database/shared/prisma/browser";
import { auth } from "@/app/lib/auth";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import { headers } from "next/headers";
import z, { prettifyError } from "zod";
import { createLog } from "../ActivityLogs/LogActions";
import { NewUserSchema } from "./schema";

export async function getAccounts(): Promise<ActionResult<User[]>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
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

export async function hasPassword(): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const user = await prisma.account.findFirst({
      where: { userId: sessionValidation.result.id, providerId: "credential" },
    });

    if (user) {
      return { success: true, result: undefined };
    } else {
      return { success: false, error: "Not first login" };
    }
  } catch (error) {
    console.error("Error checking first login:", error);
    return { success: false, error: "Failed to check first login" };
  }
}

export async function createAccount(
  newUser: NewUserSchema,
): Promise<ActionResult<User>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const validation = NewUserSchema.safeParse(newUser);
    if (!validation.success) {
      throw new Error("Invalid user data: " + prettifyError(validation.error));
    }

    await auth.api.signInMagicLink({
      body: {
        email: validation.data.email,
      },
      headers: await headers(),
    });

    const createdUser = await auth.api.createUser({
      body: {
        email: validation.data.email,
        name: validation.data.name,
      },
      headers: await headers(),
    });

    if (!createdUser.user) {
      throw new Error("Error creating user");
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
    console.error("Error creating account: ", (error as Error).message);
    return {
      success: false,
      error: "Failed to create account: " + (error as Error).message,
    };
  }
}

export async function sendMagicEmail(
  email: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const hasCredential = await prisma.account.findFirst({
      where: { providerId: "credential", user: { email: email } },
    });

    if (hasCredential) {
      throw new Error("User already has a password set");
    }

    await auth.api.signInMagicLink({
      body: {
        email: email,
      },
      headers: await headers(),
    });

    await createLog({
      action: LogAction.SEND_MAGIC_LINK,
      details: { email },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error sending magic email: ", (error as Error).message);
    return {
      success: false,
      error: "Failed to send magic email: " + (error as Error).message,
    };
  }
}

export async function updateRole(
  userId: string[],
  newRole: Roles,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
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

export async function cancelPendingAccount(
  userId: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.status !== Status.PENDING) {
      throw new Error("Only pending users can be cancelled");
    }

    await auth.api.revokeUserSessions({
      body: {
        userId: user.id,
      },
      headers: await headers(),
    });

    await prisma.user.delete({
      where: { id: user.id },
    });

    await createLog({
      action: LogAction.DELETE_USER,
      details: {
        id: user.id,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error cancelling pending account:", error);
    return {
      success: false,
      error: "Failed to cancel pending account",
    };
  }
}

export async function deleteAccount(userId: string): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    if (sessionValidation.result.id === userId) {
      throw new Error("You cannot delete your own account");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    await auth.api.removeUser({
      body: {
        userId: user.id,
      },
      headers: await headers(),
    });

    await createLog({
      action: LogAction.DELETE_USER,
      details: {
        id: user.id,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting account:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete account",
    };
  }
}

export async function deactivateAccount(
  userId: string[],
  banReason?: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
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

      await auth.api.revokeUserSessions({
        body: {
          userId: user.id,
        },
        headers: await headers(),
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { status: Status.DEACTIVATED },
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

export async function reactivateAccount(
  userId: string[],
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([Roles.ADMIN]);
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

      await prisma.user.update({
        where: { id: user.id },
        data: { status: Status.ACTIVE },
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

export async function setInitialPassword(
  password: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const user = await prisma.account.findFirst({
      where: { userId: sessionValidation.result.id, providerId: "credential" },
    });

    if (user) {
      throw new Error("Password already set");
    }

    await auth.api.setPassword({
      body: {
        newPassword: password,
      },
      headers: await headers(), // headers containing the user's session token
    });

    await prisma.user.update({
      where: { id: sessionValidation.result.id },
      data: { status: Status.ACTIVE },
    });

    await createLog({
      action: LogAction.SET_INITIAL_PASSWORD,
      details: { id: sessionValidation.result.id },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error setting password:", error);
    return { success: false, error: "Failed to set password" };
  }
}

export async function recordPasswordChange(): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    await createLog({
      action: LogAction.CHANGE_PASSWORD,
      details: { id: sessionValidation.result.id },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error logging password change:", error);
    return { success: false, error: "Failed to log password change" };
  }
}

export async function updateStatus(
  status: Status,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const statusSchema = z.enum(Status);
    const validation = statusSchema.safeParse(status);
    if (!validation.success) {
      throw new Error("Invalid status: " + prettifyError(validation.error));
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: sessionValidation.result.id },
      select: { status: true },
    });

    await prisma.user.update({
      where: { id: sessionValidation.result.id },
      data: { status: status },
    });

    await createLog({
      action: LogAction.UPDATE_STATUS,
      details: {
        id: sessionValidation.result.id,
        from: existingUser?.status ?? null,
        to: status,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error updating status:", error);
    return { success: false, error: "Failed to update status" };
  }
}
