import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const { signIn, signUp, useSession } = createAuthClient({
  baseURL: import.meta.env.BACKEND_URL || "http://localhost:3000",
  plugins: [adminClient()],
});
