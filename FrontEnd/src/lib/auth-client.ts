import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const { signIn, signUp, useSession } = createAuthClient({
  baseURL: API_URL,
  plugins: [adminClient()],
});
