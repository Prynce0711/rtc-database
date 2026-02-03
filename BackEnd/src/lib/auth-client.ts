import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import { env } from "prisma/config";

export const { signIn, signUp, useSession } = createAuthClient({
  baseURL: env("BETTER_AUTH_BASE_URL"),
  plugins: [adminClient()],
});
