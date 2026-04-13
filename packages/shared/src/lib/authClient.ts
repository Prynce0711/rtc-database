import {
  adminClient,
  inferAdditionalFields,
  magicLinkClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const DEFAULT_AUTH_BASE_URL = "http://localhost:3000";

function resolveAuthBaseUrl(): string {
  const viteEnv = (import.meta as { env?: Record<string, string | undefined> })
    .env;
  const fromVite =
    viteEnv?.VITE_BETTER_AUTH_URL ??
    viteEnv?.NEXT_PUBLIC_BETTER_AUTH_URL ??
    viteEnv?.BETTER_AUTH_URL;

  const fromProcess =
    typeof process !== "undefined"
      ? (process.env?.NEXT_PUBLIC_BETTER_AUTH_URL ??
        process.env?.BETTER_AUTH_URL)
      : undefined;

  return fromVite ?? fromProcess ?? DEFAULT_AUTH_BASE_URL;
}

function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function createClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      adminClient(),
      magicLinkClient(),
      inferAdditionalFields({
        user: {
          role: {
            type: "string",
            input: false,
          },
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
}

type AuthClient = ReturnType<typeof createClient>;
type BaseUseSession = AuthClient["useSession"];

type AuthUser = AuthClient["$Infer"]["Session"]["user"] & {
  role?: string | null;
  status?: string | null;
  darkMode?: boolean | null;
  branch?: string | null;
};

type AuthSession = Omit<AuthClient["$Infer"]["Session"], "user"> & {
  user: AuthUser;
};

type UseSessionReturnWithAdditionalUserFields = Omit<
  ReturnType<BaseUseSession>,
  "data"
> & {
  data: AuthSession | null;
};

let currentAuthBaseUrl = normalizeBackendUrl(resolveAuthBaseUrl());
let currentAuthClient = createClient(currentAuthBaseUrl);
export let authBaseUrl = currentAuthBaseUrl;

export function getBackendUrl(): string {
  return currentAuthBaseUrl;
}

export function setBackendUrl(url: string): void {
  const normalized = normalizeBackendUrl(url);
  if (!normalized || normalized === currentAuthBaseUrl) {
    return;
  }

  currentAuthBaseUrl = normalized;
  authBaseUrl = normalized;
  currentAuthClient = createClient(currentAuthBaseUrl);
}

export const authClient: AuthClient = new Proxy({} as AuthClient, {
  get(_, prop) {
    return currentAuthClient[prop as keyof AuthClient];
  },
});

export function getAuthClient(): AuthClient {
  return currentAuthClient;
}

export const signIn: AuthClient["signIn"] = new Proxy(
  {} as AuthClient["signIn"],
  {
    get(_, prop) {
      return currentAuthClient.signIn[prop as keyof AuthClient["signIn"]];
    },
  },
);

export const signUp: AuthClient["signUp"] = new Proxy(
  {} as AuthClient["signUp"],
  {
    get(_, prop) {
      return currentAuthClient.signUp[prop as keyof AuthClient["signUp"]];
    },
  },
);

export const signOut: AuthClient["signOut"] = (...args) =>
  currentAuthClient.signOut(...args);
export const useSession = ((...args: Parameters<BaseUseSession>) =>
  currentAuthClient.useSession(
    ...args,
  ) as UseSessionReturnWithAdditionalUserFields) as (
  ...args: Parameters<BaseUseSession>
) => UseSessionReturnWithAdditionalUserFields;

export type Session = AuthSession;
export type User = AuthUser;
