import { createAuthClient } from "better-auth/client";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { env } from "prisma/config";
import { auth } from "./auth";

const authClient = createAuthClient({
  baseURL: env("BETTER_AUTH_BASE_URL"),
  plugins: [adminClient(), inferAdditionalFields<typeof auth>()],
});
export const { signIn, signUp, useSession } = authClient;

export type Session = typeof authClient.$Infer.Session;
