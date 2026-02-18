"use server";

import { LogAction, User } from "@/app/generated/prisma/browser";
import { auth } from "@/app/lib/auth";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { headers } from "next/headers";
import { prettifyError } from "zod";
import ActionResult from "../ActionResult";
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

    console.log(user);

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

    await auth.api.signInMagicLink({
      body: {
        email: email,
      },
      headers: await headers(),
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

export async function changeRole(
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
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error setting password:", error);
    return { success: false, error: "Failed to set password" };
  }
}
