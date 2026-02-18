import {
  adminClient,
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
  plugins: [
    adminClient(),
    magicLinkClient(),
    inferAdditionalFields<typeof auth>(),
    inferAdditionalFields({
      user: {
        status: {
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
