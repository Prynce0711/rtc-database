import { createAuthClient } from "better-auth/client";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { getApiUrl } from "./api";

let authClient = createAuthClient({
  baseURL: getApiUrl(),
  plugins: [
    adminClient(),
    inferAdditionalFields({
      user: {
        role: {
          type: "string",
        },
      },
    }),
  ],
});

export const reinitializeAuthClient = () => {
  authClient = createAuthClient({
    baseURL: getApiUrl(),
    plugins: [
      adminClient(),
      inferAdditionalFields({
        user: {
          role: {
            type: "string",
          },
        },
      }),
    ],
  });
  console.log("🔐 Auth client reinitialized with URL:", getApiUrl());
};

export const getAuthClient = () => authClient;
export type Session = typeof authClient.$Infer.Session;
