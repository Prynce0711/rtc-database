import "server-only";

import rclone from "rclone.js";

import {
  RCLONE_CONFIG_PATH,
  getRemoteConfigMap,
  type ParsedRemoteConfig,
} from "../configStore";

const DROPBOX_CURRENT_ACCOUNT_ENDPOINT =
  "https://api.dropboxapi.com/2/users/get_current_account";

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

export interface DropboxRemoteIdentityFallbackDeps {
  getRemoteConfigMap: () => Promise<Map<string, ParsedRemoteConfig>>;
  runRcloneCommand: RunRcloneCommand;
}

const DEFAULT_DROPBOX_REMOTE_IDENTITY_FALLBACK_DEPS: DropboxRemoteIdentityFallbackDeps =
  {
    getRemoteConfigMap,
    runRcloneCommand: runRcloneCommandWithDefaultConfig,
  };

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function extractDropboxAccountIdentity(rawValue: unknown): string | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const candidate = rawValue as Record<string, unknown>;
  const email = normalizeNonEmptyString(candidate.email);
  if (email) {
    return email;
  }

  const name =
    candidate.name && typeof candidate.name === "object"
      ? (candidate.name as Record<string, unknown>)
      : null;

  if (!name) {
    return null;
  }

  const displayCandidates = [
    name.display_name,
    name.familiar_name,
    name.abbreviated_name,
  ];

  for (const rawEntry of displayCandidates) {
    const normalized = normalizeNonEmptyString(rawEntry);
    if (normalized) {
      return normalized;
    }
  }

  const givenName = normalizeNonEmptyString(name.given_name);
  const surname = normalizeNonEmptyString(name.surname);
  if (givenName && surname) {
    return `${givenName} ${surname}`;
  }

  return givenName || surname;
}

export async function getDropboxAccountIdentityFromAccessToken(
  accessToken: string,
): Promise<string | null> {
  try {
    const response = await fetch(DROPBOX_CURRENT_ACCOUNT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "null",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const rawText = (await response.text()).trim();
    if (!rawText) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawText) as unknown;
      return extractDropboxAccountIdentity(parsed);
    } catch {
      return null;
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

export async function getDropboxAccountIdentityFallback(
  normalizedRemoteName: string,
  deps: DropboxRemoteIdentityFallbackDeps = DEFAULT_DROPBOX_REMOTE_IDENTITY_FALLBACK_DEPS,
): Promise<string | null> {
  const fetchFromCurrentConfig = async (): Promise<string | null> => {
    const configMap = await deps.getRemoteConfigMap();
    const options = configMap.get(normalizedRemoteName)?.options ?? {};
    const accessToken = parseRemoteAccessToken(options);

    if (!accessToken) {
      return null;
    }

    return getDropboxAccountIdentityFromAccessToken(accessToken);
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
