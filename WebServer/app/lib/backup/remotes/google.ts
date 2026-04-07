import "server-only";

import rclone from "rclone.js";

import {
  RCLONE_CONFIG_PATH,
  getRemoteConfigMap,
  type ParsedRemoteConfig,
} from "../configStore";

const USERINFO_EMAIL_FIELD_KEYS = new Set([
  "email",
  "emailaddress",
  "mail",
  "primaryemail",
  "userprincipalname",
]);

const GOOGLE_DRIVE_ABOUT_ENDPOINT =
  "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)";

interface RunRcloneCommandOptions {
  silent?: boolean;
  trackAsActiveBackup?: boolean;
  trackAsActiveAccountSetup?: boolean;
}

type RunRcloneCommand = (
  args: string[],
  flags?: Record<string, unknown>,
  options?: RunRcloneCommandOptions,
) => Promise<string>;

function formatRemoteError(error: unknown): string {
  if (Buffer.isBuffer(error)) {
    const message = error.toString("utf8").trim();
    return message || "rclone command failed";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown backup error";
}

async function runRcloneCommandWithDefaultConfig(
  args: string[],
  flags: Record<string, unknown> = {},
): Promise<string> {
  try {
    const subprocess = rclone(...args, {
      config: RCLONE_CONFIG_PATH,
      ...flags,
    });

    return await new Promise<string>((resolve, reject) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      subprocess.stdout?.on("data", (chunk) => {
        stdoutChunks.push(Buffer.from(chunk));
      });

      subprocess.stderr?.on("data", (chunk) => {
        stderrChunks.push(Buffer.from(chunk));
      });

      subprocess.on("error", (error) => {
        reject(error);
      });

      subprocess.on("close", (code) => {
        const stdoutText = Buffer.concat(stdoutChunks).toString("utf8").trim();
        const stderrText = Buffer.concat(stderrChunks).toString("utf8").trim();

        if ((code ?? 0) === 0) {
          resolve(stdoutText);
          return;
        }

        reject(
          new Error(
            stderrText ||
              stdoutText ||
              `rclone command failed with exit code ${String(code)}`,
          ),
        );
      });
    });
  } catch (error) {
    const message = formatRemoteError(error);
    const lowered = message.toLowerCase();

    if (lowered.includes("enoent") && lowered.includes("rclone")) {
      throw new Error(
        "rclone executable was not found. Run `pnpm --dir WebServer rebuild rclone.js` and restart the server.",
      );
    }

    throw error instanceof Error ? error : new Error(message);
  }
}

export interface GoogleRemoteIdentityFallbackDeps {
  getRemoteConfigMap: () => Promise<Map<string, ParsedRemoteConfig>>;
  runRcloneCommand: RunRcloneCommand;
}

const DEFAULT_GOOGLE_REMOTE_IDENTITY_FALLBACK_DEPS: GoogleRemoteIdentityFallbackDeps =
  {
    getRemoteConfigMap,
    runRcloneCommand: runRcloneCommandWithDefaultConfig,
  };

function findEmailInText(value: string): string | null {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match || !match[0]) {
    return null;
  }

  return match[0];
}

function findValueByKnownKeys(
  value: unknown,
  keys: Set<string>,
): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findValueByKnownKeys(entry, keys);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const normalizedKey = rawKey.trim().toLowerCase();

    if (keys.has(normalizedKey) && typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    const nested = findValueByKnownKeys(rawValue, keys);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function findEmailInUnknownValue(value: unknown): string | null {
  if (typeof value === "string") {
    return findEmailInText(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = findEmailInUnknownValue(entry);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  for (const nestedValue of Object.values(value)) {
    const nested = findEmailInUnknownValue(nestedValue);
    if (nested) {
      return nested;
    }
  }

  return null;
}

export function extractAccountIdentityFromUserInfo(
  parsed: unknown,
  rawText?: string,
): string | null {
  const keyedValue = findValueByKnownKeys(parsed, USERINFO_EMAIL_FIELD_KEYS);
  if (keyedValue) {
    return keyedValue;
  }

  const emailLike = findEmailInUnknownValue(parsed);
  if (emailLike) {
    return emailLike;
  }

  if (!rawText) {
    return null;
  }

  return findEmailInText(rawText);
}

export async function getGoogleDriveAccountIdentityFromAccessToken(
  accessToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(GOOGLE_DRIVE_ABOUT_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return extractAccountIdentityFromUserInfo(parsed, trimmed);
    } catch {
      return extractAccountIdentityFromUserInfo(trimmed, trimmed);
    }
  } catch {
    return null;
  }
}

function parseRemoteAccessToken(
  options: Record<string, string>,
): string | null {
  const rawToken = options.token;
  if (!rawToken) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawToken) as { access_token?: unknown };
    const accessToken =
      typeof parsed.access_token === "string" ? parsed.access_token.trim() : "";

    return accessToken || null;
  } catch {
    return null;
  }
}

export async function getGoogleDriveAccountIdentityFallback(
  normalizedRemoteName: string,
  deps: GoogleRemoteIdentityFallbackDeps = DEFAULT_GOOGLE_REMOTE_IDENTITY_FALLBACK_DEPS,
): Promise<string | null> {
  const fetchFromCurrentConfig = async (): Promise<string | null> => {
    const configMap = await deps.getRemoteConfigMap();
    const options = configMap.get(normalizedRemoteName)?.options ?? {};
    const accessToken = parseRemoteAccessToken(options);

    if (!accessToken) {
      return null;
    }

    return getGoogleDriveAccountIdentityFromAccessToken(accessToken);
  };

  const identityFromCurrentToken = await fetchFromCurrentConfig();
  if (identityFromCurrentToken) {
    return identityFromCurrentToken;
  }

  try {
    await deps.runRcloneCommand(
      ["lsf", `${normalizedRemoteName}:`],
      {
        "max-depth": 1,
      },
      {
        silent: true,
      },
    );
  } catch {
    // Ignore; token may still refresh depending on provider behavior.
  }

  return fetchFromCurrentConfig();
}
