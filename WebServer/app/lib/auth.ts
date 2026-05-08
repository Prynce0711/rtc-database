import { ChatType } from "@rtc-database/shared/prisma/browser";
import {
  LogAction,
  Roles as PrismaRole,
} from "@rtc-database/shared/prisma/enums";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin, magicLink, twoFactor } from "better-auth/plugins";
import { randomInt } from "node:crypto";
import { createLog } from "../components/ActivityLogs/LogActions";
import { sendEmail } from "./email";
import { getAllowedOrigins } from "./originAllowlist";
import { prisma } from "./prisma";
// If your Prisma file is located elsewhere, you can change the path

const ROLE_VALUES = new Set(Object.values(PrismaRole));
const MAGIC_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const MAGIC_CODE_LENGTH = 10;
const MAGIC_CODE_GROUP_SIZE = 5;
const MAGIC_CODE_EXPIRY_MINUTES = 5;

const generateMagicCode = (): string =>
  Array.from(
    { length: MAGIC_CODE_LENGTH },
    () => MAGIC_CODE_ALPHABET[randomInt(0, MAGIC_CODE_ALPHABET.length)],
  ).join("");

const formatMagicCode = (token: string): string =>
  token
    .match(new RegExp(`.{1,${String(MAGIC_CODE_GROUP_SIZE)}}`, "g"))
    ?.join("-") ?? token;

const asMutableRecord = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const getStringProperty = (
  value: unknown,
  propertyName: string,
): string | undefined => {
  const record = asMutableRecord(value);
  const propertyValue = record?.[propertyName];
  return typeof propertyValue === "string" ? propertyValue : undefined;
};

const createDirectChatsForRole = async (role: string, userId: string) => {
  if (!role || !userId) return;

  const normalizedRole = ROLE_VALUES.has(role as PrismaRole)
    ? (role as PrismaRole)
    : undefined;
  if (!normalizedRole) return;

  const users = await prisma.user.findMany({
    where: {
      role: normalizedRole,
      AND: [{ id: { not: userId } }],
    },
    select: { id: true },
  });

  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  const existingChats = await prisma.chat.findMany({
    where: {
      type: ChatType.DIRECT,
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: { in: userIds } } } },
      ],
    },
    select: {
      members: {
        select: { userId: true },
      },
    },
  });

  const existingUserIds = new Set<string>();
  for (const chat of existingChats) {
    for (const member of chat.members) {
      if (member.userId !== userId) {
        existingUserIds.add(member.userId);
      }
    }
  }

  for (const user of users) {
    if (existingUserIds.has(user.id)) continue;

    await prisma.chat.create({
      data: {
        type: ChatType.DIRECT,
        members: {
          create: [{ userId }, { userId: user.id }],
        },
      },
    });
  }
};

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
  trustedOrigins: getAllowedOrigins(),
  database: prismaAdapter(prisma, {
    provider: "sqlite", // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.NODE_ENV === "production", // Disable sign-up in production
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        "Reset your RTC Database password",
        [
          `Hello ${user.name || "there"},`,
          "",
          "We received a request to reset your RTC Database password.",
          "",
          "Open this link to choose a new password:",
          url,
          "",
          "This link expires in 1 hour. If you did not request this, you can ignore this email.",
        ].join("\n"),
      );
    },
    onPasswordReset: async ({ user }) => {
      await prisma.log.create({
        data: {
          action: LogAction.RESET_PASSWORD,
          userId: user.id,
          details: { id: user.id, email: user.email },
        },
      });
    },
  },
  plugins: [
    admin(),
    twoFactor(),
    magicLink({
      allowedAttempts: 5,
      expiresIn: MAGIC_CODE_EXPIRY_MINUTES * 60, // in seconds
      generateToken: async () => generateMagicCode(),
      sendMagicLink: async ({ email, token }) => {
        const formattedCode = formatMagicCode(token);

        await sendEmail(
          email,
          "Your Magic Code for RTC Database",
          [
            "Use this magic code to sign in to RTC Database:",
            "",
            formattedCode,
            "",
            `This code expires in ${String(MAGIC_CODE_EXPIRY_MINUTES)} minutes.`,
            "Open the RTC Database login page on a device connected to the same local network, choose Magic Code, and paste this code there.",
          ].join("\n"),
        );
      },
      disableSignUp: true,
    }),
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
      },
      status: {
        type: "string",
        input: false,
      },
      darkMode: {
        type: "boolean",
        input: false,
      },
      tutorialStatus: {
        type: "string",
        input: false,
      },
      tutorialCompletedAt: {
        type: "date",
        input: false,
      },
      tutorialSkippedAt: {
        type: "date",
        input: false,
      },
      tutorialLastStartedAt: {
        type: "date",
        input: false,
      },
      branch: {
        type: "string",
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (
        ctx.method === "POST" &&
        (ctx.path.startsWith("/sign-in") || ctx.path.includes("sign-in"))
      ) {
        const email = ctx.body?.email;
        const success = ctx.context.newSession?.user ? true : false;

        console.log(`Login attempt for email: ${email}, success: ${success}`);

        if (success) {
          await createLog({
            action: LogAction.LOGIN_SUCCESS,
            details: {
              id: ctx.context.newSession?.user?.id || "",
            },
          });
        } else {
          await createLog({
            action: LogAction.LOGIN_FAILED,
            details: {
              email: email,
            },
          });
        }
      }

      if (
        ctx.method === "POST" &&
        (ctx.path.includes("sign-up") || ctx.path.includes("create-user"))
      ) {
        try {
          const email =
            typeof ctx.body?.email === "string" ? ctx.body.email : undefined;

          let createdUserId = getStringProperty(
            ctx.context.newSession?.user,
            "id",
          );
          let createdUserRole = getStringProperty(
            ctx.context.newSession?.user,
            "role",
          );

          if ((!createdUserId || !createdUserRole) && email) {
            const createdUser = await prisma.user.findUnique({
              where: { email },
              select: { id: true, role: true },
            });

            if (createdUser) {
              createdUserId = createdUser.id;
              createdUserRole = createdUser.role ?? undefined;
            }
          }

          if (createdUserId && createdUserRole) {
            await createDirectChatsForRole(createdUserRole, createdUserId);
          }
        } catch (chatSeedError) {
          console.error(
            "Failed to initialize direct chats after sign-up:",
            chatSeedError,
          );
        }
      }

      // Defensive: ensure any session user ids are safe to JSON.stringify
      try {
        const newSessionUser = asMutableRecord(ctx.context.newSession?.user);
        if (newSessionUser) {
          const uid = newSessionUser.id;
          if (typeof uid === "bigint") {
            newSessionUser.id = String(uid);
          }
        }
        const sessionUser = asMutableRecord(ctx.context.session?.user);
        if (sessionUser) {
          const sid = sessionUser.id;
          if (typeof sid === "bigint") {
            sessionUser.id = String(sid);
          }
        }
      } catch {
        // Ignore failures here; this is non-critical cleanup.
      }
    }),
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-out") && ctx.method === "POST") {
        await createLog({
          action: LogAction.LOGOUT,
          details: null,
        });
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
