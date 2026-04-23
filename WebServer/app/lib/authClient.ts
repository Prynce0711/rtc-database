import {
  adminClient,
  inferAdditionalFields,
  magicLinkClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";

const resolveAuthBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    const currentOrigin = window.location.origin;
    if (currentOrigin && currentOrigin !== "null") {
      return currentOrigin;
    }
  }

  return process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
};

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
  plugins: [
    adminClient(),
    magicLinkClient(),
    twoFactorClient({
      twoFactorPage: "/two-factor",
    }),
    inferAdditionalFields<typeof auth>(),
    inferAdditionalFields({
      user: {
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
    }),
  ],
});
export const { signIn, signUp, useSession, signOut } = authClient;

export type Session = typeof authClient.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
