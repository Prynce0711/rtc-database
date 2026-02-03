import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const { signIn, signUp, useSession } = createAuthClient({
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  plugins: [adminClient()],
});
