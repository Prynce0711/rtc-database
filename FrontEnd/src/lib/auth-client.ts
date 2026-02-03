import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import { getApiUrl } from "./api";

let authClient = createAuthClient({
  baseURL: getApiUrl(),
  plugins: [adminClient()],
});

export const reinitializeAuthClient = () => {
  authClient = createAuthClient({
    baseURL: getApiUrl(),
    plugins: [adminClient()],
  });
  console.log("🔐 Auth client reinitialized with URL:", getApiUrl());
};

export const getAuthClient = () => authClient;
