import { ChatType } from "@rtc-database/shared/prisma/browser";
import {
  LogAction,
  Roles as PrismaRole,
} from "@rtc-database/shared/prisma/enums";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin, magicLink, twoFactor } from "better-auth/plugins";
import { createLog } from "../components/ActivityLogs/LogActions";
import { sendEmail } from "./email";
import { prisma } from "./prisma";
// If your Prisma file is located elsewhere, you can change the path

const ROLE_VALUES = new Set(Object.values(PrismaRole));

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
  trustedOrigins: [
    process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
    process.env.NATIVE_APP_URL || "http://localhost:5173",
  ],
  database: prismaAdapter(prisma, {
    provider: "sqlite", // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.NODE_ENV === "production", // Disable sign-up in production
  },
  plugins: [
    admin(),
    twoFactor(),
    magicLink({
      sendMagicLink: async ({ email, token, url }, ctx) => {
        sendEmail(
          email,
          "Your Magic Link for RTC Database",
          `Click the link to sign in: ${url}`,
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
      if (ctx.path.startsWith("/") && ctx.method === "POST") {
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

          let createdUserId =
            typeof (ctx.context.newSession?.user as any)?.id === "string"
              ? (ctx.context.newSession?.user as any).id
              : undefined;
          let createdUserRole =
            typeof (ctx.context.newSession?.user as any)?.role === "string"
              ? (ctx.context.newSession?.user as any).role
              : undefined;

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
        if (ctx.context.newSession && ctx.context.newSession.user) {
          const uid = (ctx.context.newSession.user as any).id;
          if (typeof uid === "bigint") {
            (ctx.context.newSession.user as any).id = String(uid);
          }
        }
        if (ctx.context.session && ctx.context.session.user) {
          const sid = (ctx.context.session.user as any).id;
          if (typeof sid === "bigint") {
            (ctx.context.session.user as any).id = String(sid);
          }
        }
      } catch (e) {
        // ignore failures here — non-critical
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
