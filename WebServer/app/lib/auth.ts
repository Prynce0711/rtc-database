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
    disableSignUp: true,
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
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds (5 minutes)
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/sign-in") && ctx.method === "POST") {
        const email = ctx.body?.email;
        const success = ctx.context.newSession?.user ? true : false;

        console.log(
          "Login successful for user email:",
          ctx.context.newSession?.user?.email,
        );
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
