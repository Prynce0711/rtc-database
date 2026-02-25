import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware } from "better-auth/api";
import { admin, magicLink } from "better-auth/plugins";
import { createLog } from "../components/ActivityLogs/LogActions";
import { LogAction } from "../generated/prisma/enums";
import { sendEmail } from "./email";
import { prisma } from "./prisma";
// If your Prisma file is located elsewhere, you can change the path

export const auth = betterAuth({
  trustedOrigins: [process.env.NEXT_PUBLIC_URL || "http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "sqlite", // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.NODE_ENV === "production", // Disable sign-up in production
  },
  plugins: [
    admin(),
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
    },
  },
  session: {
    cookieCache: {
      enabled: false,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-in") && ctx.method === "POST") {
        const email = ctx.body?.email;
        const success = ctx.context.newSession?.user ? true : false;

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
