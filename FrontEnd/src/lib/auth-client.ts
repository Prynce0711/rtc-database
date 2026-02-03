import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

const API_URL = import.meta.env.API_URL || "http://localhost:3000";

console.log("Auth Client initialized with API_URL:", API_URL);

export const { signIn, signUp, useSession } = createAuthClient({
  baseURL: API_URL,
  plugins: [adminClient()],
});
