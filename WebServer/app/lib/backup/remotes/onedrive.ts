import "server-only";

import rclone from "rclone.js";

import {
  RCLONE_CONFIG_PATH,
  ensureBackupArtifacts,
  getRemoteConfigMap,
  normalizeRemoteName,
  type ParsedRemoteConfig,
} from "../configStore";

export interface OneDriveDriveOption {
  id: string;
  name: string;
  driveType: string;
  webUrl: string | null;
  isDefault: boolean;
  isConfigured: boolean;
}

export interface OneDrivePromptDriveChoice {
  optionNumber: string;
  label: string;
  driveId: string | null;
}

const ONEDRIVE_DEFAULT_DRIVE_ENDPOINT =
  "https://graph.microsoft.com/v1.0/me/drive?$select=id,name,driveType,webUrl";
const ONEDRIVE_DRIVES_ENDPOINT =
  "https://graph.microsoft.com/v1.0/me/drives?$select=id,name,driveType,webUrl";
const ONEDRIVE_USER_PROFILE_ENDPOINT =
  "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails,displayName";
const ONEDRIVE_OIDC_USERINFO_ENDPOINT =
  "https://graph.microsoft.com/oidc/userinfo";

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

const DEFAULT_LIST_ONEDRIVE_REMOTE_DRIVE_OPTIONS_DEPS: ListOneDriveRemoteDriveOptionsDeps =
  {
    ensureBackupArtifacts,
    normalizeRemoteName,
    getRemoteConfigMap,
    runRcloneCommand: runRcloneCommandWithDefaultConfig,
  };

export interface ListOneDriveRemoteDriveOptionsDeps {
  ensureBackupArtifacts: () => Promise<void>;
  normalizeRemoteName: (value: string) => string;
  getRemoteConfigMap: () => Promise<Map<string, ParsedRemoteConfig>>;
  runRcloneCommand: RunRcloneCommand;
}

export interface OneDriveRemoteIdentityFallbackDeps {
  getRemoteConfigMap: () => Promise<Map<string, ParsedRemoteConfig>>;
  runRcloneCommand: RunRcloneCommand;
}

const DEFAULT_ONEDRIVE_REMOTE_IDENTITY_FALLBACK_DEPS: OneDriveRemoteIdentityFallbackDeps =
  {
    getRemoteConfigMap,
    runRcloneCommand: runRcloneCommandWithDefaultConfig,
  };

export interface OneDriveInteractivePromptDeps {
  appendBackupLog: (level: "info" | "warn" | "error", message: string) => void;
  runRcloneCommand: RunRcloneCommand;
  redactSensitiveText: (value: string) => string;
}

export interface OneDriveInteractivePromptConfig {
  rcloneConfigPath: string;
  retries: number;
  lowLevelRetries: number;
  interactiveTimeoutMs: number;
}

export function extractFailedOnedriveDriveId(message: string): string | null {
  const match = message.match(/failed to query root for drive\s+"([^"]+)"/i);
  const driveId = match?.[1]?.trim();

  return driveId || null;
}

export function parseOneDriveDriveChoices(
  output: string,
): OneDrivePromptDriveChoice[] {
  const lines = output.split(/\r?\n/);
  const choices: OneDrivePromptDriveChoice[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const optionMatch = lines[index].match(/^\s*(\d+)\s*\/\s*(.+?)\s*$/);
    if (!optionMatch) {
      continue;
    }

    const optionNumber = optionMatch[1];
    const label = optionMatch[2].trim();
    let driveId: string | null = null;

    for (
      let lookAhead = index + 1;
      lookAhead < Math.min(lines.length, index + 5);
      lookAhead += 1
    ) {
      const driveIdMatch = lines[lookAhead].match(/^\s*\\\s*\((.+?)\)\s*$/);
      if (driveIdMatch) {
        driveId = driveIdMatch[1].trim();
        break;
      }

      if (/^\s*\d+\s*\//.test(lines[lookAhead])) {
        break;
      }
    }

    if (!choices.some((entry) => entry.optionNumber === optionNumber)) {
      choices.push({
        optionNumber,
        label,
        driveId,
      });
    }
  }

  return choices;
}

export function pickOneDriveDriveChoice(
  choices: OneDrivePromptDriveChoice[],
  failedDriveId: string | null,
  preferredDriveId: string | null = null,
): OneDrivePromptDriveChoice | null {
  if (choices.length === 0) {
    return null;
  }

  const isEligible = (entry: OneDrivePromptDriveChoice) =>
    !failedDriveId || !entry.driveId || entry.driveId !== failedDriveId;

  const normalizedPreferredDriveId = preferredDriveId?.trim() ?? "";
  if (normalizedPreferredDriveId) {
    const preferred = choices.find(
      (entry) =>
        isEligible(entry) && entry.driveId === normalizedPreferredDriveId,
    );

    if (preferred) {
      return preferred;
    }
  }

  const exactPersonal = choices.find(
    (entry) =>
      isEligible(entry) &&
      entry.label.toLowerCase().includes("onedrive (personal)"),
  );
  if (exactPersonal) {
    return exactPersonal;
  }

  const anyPersonal = choices.find(
    (entry) =>
      isEligible(entry) && entry.label.toLowerCase().includes("personal"),
  );
  if (anyPersonal) {
    return anyPersonal;
  }

  return choices.find((entry) => isEligible(entry)) ?? choices[0] ?? null;
}

function extractOneDriveDriveOption(
  rawValue: unknown,
): Omit<OneDriveDriveOption, "isDefault" | "isConfigured"> | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const candidate = rawValue as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";

  if (!id) {
    return null;
  }

  const nameRaw =
    typeof candidate.name === "string" ? candidate.name.trim() : "";
  const driveTypeRaw =
    typeof candidate.driveType === "string" ? candidate.driveType.trim() : "";
  const webUrlRaw =
    typeof candidate.webUrl === "string" ? candidate.webUrl.trim() : "";

  return {
    id,
    name: nameRaw || "Unnamed Drive",
    driveType: driveTypeRaw || "unknown",
    webUrl: webUrlRaw || null,
  };
}

async function fetchJsonWithBearerToken(
  endpoint: string,
  accessToken: string,
): Promise<unknown | null> {
  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const rawText = (await response.text()).trim();
    if (!rawText) {
      return null;
    }

    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}

export async function listOneDriveDriveOptionsFromAccessToken(
  accessToken: string,
): Promise<OneDriveDriveOption[]> {
  const [defaultDrivePayload, drivesPayload] = await Promise.all([
    fetchJsonWithBearerToken(ONEDRIVE_DEFAULT_DRIVE_ENDPOINT, accessToken),
    fetchJsonWithBearerToken(ONEDRIVE_DRIVES_ENDPOINT, accessToken),
  ]);

  const entriesById = new Map<string, OneDriveDriveOption>();

  const defaultDrive = extractOneDriveDriveOption(defaultDrivePayload);
  const defaultDriveId = defaultDrive?.id ?? null;

  if (defaultDrive) {
    entriesById.set(defaultDrive.id, {
      ...defaultDrive,
      isDefault: true,
      isConfigured: false,
    });
  }

  const valueList =
    drivesPayload &&
    typeof drivesPayload === "object" &&
    Array.isArray((drivesPayload as { value?: unknown }).value)
      ? ((drivesPayload as { value: unknown[] }).value ?? [])
      : [];

  for (const rawEntry of valueList) {
    const parsed = extractOneDriveDriveOption(rawEntry);
    if (!parsed) {
      continue;
    }

    const existing = entriesById.get(parsed.id);
    entriesById.set(parsed.id, {
      ...parsed,
      isDefault: parsed.id === defaultDriveId || (existing?.isDefault ?? false),
      isConfigured: false,
    });
  }

  return Array.from(entriesById.values()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

export function parseRemoteAccessToken(
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

function parseRemoteIdToken(options: Record<string, string>): string | null {
  const rawToken = options.token;
  if (!rawToken) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawToken) as { id_token?: unknown };
    const idToken =
      typeof parsed.id_token === "string" ? parsed.id_token.trim() : "";

    return idToken || null;
  } catch {
    return null;
  }
}

function findEmailInText(value: string): string | null {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (!match || !match[0]) {
    return null;
  }

  return match[0].trim();
}

function extractOneDriveAccountIdentity(rawValue: unknown): string | null {
  if (!rawValue || typeof rawValue !== "object") {
    return null;
  }

  const candidate = rawValue as Record<string, unknown>;

  const directCandidates = [
    candidate.mail,
    candidate.userPrincipalName,
    candidate.email,
    candidate.preferred_username,
    candidate.upn,
    candidate.unique_name,
  ];
  for (const rawEntry of directCandidates) {
    if (typeof rawEntry !== "string") {
      continue;
    }

    const trimmed = rawEntry.trim();
    if (!trimmed) {
      continue;
    }

    const email = findEmailInText(trimmed);
    if (email) {
      return email;
    }

    if (trimmed.includes("@")) {
      return trimmed;
    }
  }

  if (Array.isArray(candidate.otherMails)) {
    for (const rawEntry of candidate.otherMails) {
      if (typeof rawEntry !== "string") {
        continue;
      }

      const trimmed = rawEntry.trim();
      if (!trimmed) {
        continue;
      }

      const email = findEmailInText(trimmed);
      if (email) {
        return email;
      }
    }
  }

  const displayNameCandidates = [candidate.displayName, candidate.name];
  for (const rawEntry of displayNameCandidates) {
    if (typeof rawEntry !== "string") {
      continue;
    }

    const trimmed = rawEntry.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  const payloadPart = parts[1];
  if (!payloadPart) {
    return null;
  }

  const normalizedPayload = payloadPart.replace(/-/g, "+").replace(/_/g, "/");

  const padding = normalizedPayload.length % 4;
  const paddedPayload =
    padding === 0
      ? normalizedPayload
      : `${normalizedPayload}${"=".repeat(4 - padding)}`;

  try {
    const decoded = Buffer.from(paddedPayload, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;

    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractOneDriveAccountIdentityFromIdToken(
  idToken: string,
): string | null {
  const parsedPayload = parseJwtPayload(idToken);
  if (!parsedPayload) {
    return null;
  }

  return extractOneDriveAccountIdentity(parsedPayload);
}

function extractOneDriveAccountIdentityFromAccessTokenClaims(
  accessToken: string,
): string | null {
  const parsedPayload = parseJwtPayload(accessToken);
  if (!parsedPayload) {
    return null;
  }

  return extractOneDriveAccountIdentity(parsedPayload);
}

async function getOneDriveAccountIdentityFromOidcUserInfo(
  accessToken: string,
): Promise<string | null> {
  const payload = await fetchJsonWithBearerToken(
    ONEDRIVE_OIDC_USERINFO_ENDPOINT,
    accessToken,
  );

  return extractOneDriveAccountIdentity(payload);
}

export async function getOneDriveAccountIdentityFromAccessToken(
  accessToken: string,
): Promise<string | null> {
  const profilePayload = await fetchJsonWithBearerToken(
    ONEDRIVE_USER_PROFILE_ENDPOINT,
    accessToken,
  );
  const profileIdentity = extractOneDriveAccountIdentity(profilePayload);

  if (profileIdentity) {
    return profileIdentity;
  }

  const oidcIdentity =
    await getOneDriveAccountIdentityFromOidcUserInfo(accessToken);
  if (oidcIdentity) {
    return oidcIdentity;
  }

  return extractOneDriveAccountIdentityFromAccessTokenClaims(accessToken);
}

export async function getOneDriveAccountIdentityFallback(
  normalizedRemoteName: string,
  deps: OneDriveRemoteIdentityFallbackDeps = DEFAULT_ONEDRIVE_REMOTE_IDENTITY_FALLBACK_DEPS,
): Promise<string | null> {
  const fetchFromCurrentConfig = async (): Promise<string | null> => {
    const configMap = await deps.getRemoteConfigMap();
    const options = configMap.get(normalizedRemoteName)?.options ?? {};
    const accessToken = parseRemoteAccessToken(options);
    const idToken = parseRemoteIdToken(options);

    if (accessToken) {
      const identityFromAccessToken =
        await getOneDriveAccountIdentityFromAccessToken(accessToken);

      if (identityFromAccessToken) {
        return identityFromAccessToken;
      }
    }

    if (idToken) {
      const identityFromIdToken =
        extractOneDriveAccountIdentityFromIdToken(idToken);

      if (identityFromIdToken) {
        return identityFromIdToken;
      }
    }

    return null;
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

export async function listOneDriveRemoteDriveOptions(
  remoteName: string,
  deps: ListOneDriveRemoteDriveOptionsDeps = DEFAULT_LIST_ONEDRIVE_REMOTE_DRIVE_OPTIONS_DEPS,
): Promise<OneDriveDriveOption[]> {
  await deps.ensureBackupArtifacts();

  const normalizedName = deps.normalizeRemoteName(remoteName);
  if (!normalizedName) {
    throw new Error("Remote name is required.");
  }

  const getRemoteContext = async (): Promise<{
    accessToken: string;
    configuredDriveId: string | null;
  }> => {
    const configMap = await deps.getRemoteConfigMap();
    const remoteConfig = configMap.get(normalizedName);

    if (!remoteConfig) {
      throw new Error(`Remote ${normalizedName} was not found.`);
    }

    const provider = remoteConfig.provider.trim().toLowerCase();
    if (provider !== "onedrive") {
      throw new Error(`Remote ${normalizedName} is not a OneDrive account.`);
    }

    const accessToken = parseRemoteAccessToken(remoteConfig.options);
    if (!accessToken) {
      throw new Error(
        "No OneDrive access token is available. Re-login this account and try again.",
      );
    }

    const configuredDriveId =
      remoteConfig.options.drive_id?.trim() ||
      remoteConfig.options.config_driveid?.trim() ||
      null;

    return {
      accessToken,
      configuredDriveId,
    };
  };

  let { accessToken, configuredDriveId } = await getRemoteContext();
  let driveOptions = await listOneDriveDriveOptionsFromAccessToken(accessToken);

  if (driveOptions.length === 0) {
    try {
      await deps.runRcloneCommand(
        ["lsf", `${normalizedName}:`],
        {
          "max-depth": 1,
        },
        {
          silent: true,
        },
      );
    } catch {
      // Ignore; refresh attempts are best-effort.
    }

    const refreshedContext = await getRemoteContext();
    accessToken = refreshedContext.accessToken;
    configuredDriveId = refreshedContext.configuredDriveId;
    driveOptions = await listOneDriveDriveOptionsFromAccessToken(accessToken);
  }

  if (driveOptions.length === 0) {
    throw new Error(
      "No OneDrive drives were found for this account. Try re-login and try again.",
    );
  }

  const withConfiguredFlag = driveOptions.map((entry) => ({
    ...entry,
    isConfigured: !!configuredDriveId && entry.id === configuredDriveId,
  }));

  if (
    configuredDriveId &&
    !withConfiguredFlag.some((entry) => entry.isConfigured)
  ) {
    withConfiguredFlag.unshift({
      id: configuredDriveId,
      name: "Configured Drive (not in current drive list)",
      driveType: "unknown",
      webUrl: null,
      isDefault: false,
      isConfigured: true,
    });
  }

  return withConfiguredFlag;
}

export async function retryOnedriveCreateWithDriveSelection(
  remoteName: string,
  providerOptions: Record<string, string>,
  deps: OneDriveInteractivePromptDeps,
  config: OneDriveInteractivePromptConfig,
  failedMessage?: string,
): Promise<void> {
  const token = providerOptions.token?.trim() ?? "";
  if (!token) {
    throw new Error(
      failedMessage ||
        "OneDrive token is missing. Please authorize again and retry.",
    );
  }

  const failedDriveId = failedMessage
    ? extractFailedOnedriveDriveId(failedMessage)
    : null;
  const preferredConfiguredDriveId =
    providerOptions.config_driveid?.trim() ||
    providerOptions.drive_id?.trim() ||
    null;

  deps.appendBackupLog(
    "warn",
    failedMessage
      ? "OneDrive default drive was invalid. Retrying account setup with explicit drive selection."
      : "Creating OneDrive account with explicit drive selection.",
  );

  try {
    await deps.runRcloneCommand(
      ["config", "delete", remoteName],
      {},
      { silent: true },
    );
  } catch {
    // Ignore delete failures before retrying create.
  }

  const subprocess = rclone(
    "config",
    "create",
    remoteName,
    "onedrive",
    "token",
    token,
    "config_is_local",
    "false",
    {
      config: config.rcloneConfigPath,
      "auto-confirm": true,
      retries: config.retries,
      "low-level-retries": config.lowLevelRetries,
    },
  );

  let stdoutText = "";
  let stderrText = "";
  let browserPromptHandled = 0;
  let configTypePromptHandled = 0;
  let configDriveIdPromptHandled = 0;
  let driveOkPromptHandled = 0;
  let keepRemotePromptHandled = 0;

  const tryRespondToPrompts = () => {
    const combinedOutput = `${stdoutText}\n${stderrText}`;
    const driveChoices = parseOneDriveDriveChoices(combinedOutput);
    const preferredChoice = pickOneDriveDriveChoice(
      driveChoices,
      failedDriveId,
      preferredConfiguredDriveId,
    );

    const browserPromptCount = (
      combinedOutput.match(
        /Use web browser to automatically authenticate rclone with remote\?[\s\S]*?y\/n>/gi,
      ) ?? []
    ).length;
    while (browserPromptHandled < browserPromptCount) {
      subprocess.stdin?.write("n\n");
      browserPromptHandled += 1;
    }

    const configTypePromptCount = (combinedOutput.match(/config_type>/g) ?? [])
      .length;
    while (configTypePromptHandled < configTypePromptCount) {
      subprocess.stdin?.write("1\n");
      configTypePromptHandled += 1;
    }

    const configDriveIdPromptCount = (
      combinedOutput.match(/config_driveid>/g) ?? []
    ).length;
    while (configDriveIdPromptHandled < configDriveIdPromptCount) {
      const selectedValue =
        preferredChoice?.optionNumber ?? preferredConfiguredDriveId ?? "";
      subprocess.stdin?.write(`${selectedValue}\n`);
      configDriveIdPromptHandled += 1;

      if (preferredChoice?.optionNumber) {
        deps.appendBackupLog(
          "info",
          `Using OneDrive drive option ${preferredChoice.optionNumber}${preferredChoice.label ? ` (${preferredChoice.label})` : ""}.`,
        );
      } else if (selectedValue) {
        deps.appendBackupLog(
          "info",
          "Using configured OneDrive drive ID value.",
        );
      }
    }

    const driveOkPromptCount = (combinedOutput.match(/Drive OK\?/gi) ?? [])
      .length;
    while (driveOkPromptHandled < driveOkPromptCount) {
      subprocess.stdin?.write("y\n");
      driveOkPromptHandled += 1;
    }

    const keepRemotePromptCount = (combinedOutput.match(/y\/e\/d>/gi) ?? [])
      .length;
    while (keepRemotePromptHandled < keepRemotePromptCount) {
      subprocess.stdin?.write("y\n");
      keepRemotePromptHandled += 1;
    }
  };

  await new Promise<void>((resolve, reject) => {
    const interactiveTimeout = setTimeout(() => {
      try {
        subprocess.kill();
      } catch {
        // Ignore kill failures; close/error handlers will finish the promise.
      }
    }, config.interactiveTimeoutMs);

    subprocess.stdout?.on("data", (chunk) => {
      stdoutText += Buffer.from(chunk).toString("utf8");
      tryRespondToPrompts();
    });

    subprocess.stderr?.on("data", (chunk) => {
      stderrText += Buffer.from(chunk).toString("utf8");
      tryRespondToPrompts();
    });

    subprocess.on("error", (error) => {
      clearTimeout(interactiveTimeout);
      reject(error);
    });

    subprocess.on("close", (code) => {
      clearTimeout(interactiveTimeout);
      if ((code ?? 0) === 0) {
        resolve();
        return;
      }

      const combined = deps.redactSensitiveText(
        `${stderrText}\n${stdoutText}`.trim(),
      );
      reject(
        new Error(
          combined ||
            `rclone config create failed with exit code ${String(code ?? 0)}`,
        ),
      );
    });
  });
}

export async function updateOnedriveDriveSelectionWithoutRefresh(
  remoteName: string,
  preferredDriveId: string | null,
  tokenForConfigTokenPrompt: string | null,
  deps: OneDriveInteractivePromptDeps,
  config: OneDriveInteractivePromptConfig,
): Promise<void> {
  deps.appendBackupLog(
    "warn",
    "Updating OneDrive drive selection without token refresh.",
  );

  const subprocess = rclone("config", "update", remoteName, {
    config: config.rcloneConfigPath,
    all: true,
    "auto-confirm": true,
    retries: config.retries,
    "low-level-retries": config.lowLevelRetries,
  });

  let stdoutText = "";
  let stderrText = "";
  let clientIdPromptHandled = 0;
  let clientSecretPromptHandled = 0;
  let regionPromptHandled = 0;
  let tenantPromptHandled = 0;
  let advancedConfigPromptHandled = 0;
  let tokenRefreshPromptHandled = 0;
  let browserPromptHandled = 0;
  let configTokenPromptHandled = 0;
  let configTypePromptHandled = 0;
  let configDriveIdPromptHandled = 0;
  let driveOkPromptHandled = 0;
  let keepRemotePromptHandled = 0;

  const tryRespondToPrompts = () => {
    const combinedOutput = `${stdoutText}\n${stderrText}`;
    const driveChoices = parseOneDriveDriveChoices(combinedOutput);
    const preferredChoice = pickOneDriveDriveChoice(
      driveChoices,
      null,
      preferredDriveId,
    );

    const clientIdPromptCount = (combinedOutput.match(/client_id>/g) ?? [])
      .length;
    while (clientIdPromptHandled < clientIdPromptCount) {
      subprocess.stdin?.write("\n");
      clientIdPromptHandled += 1;
    }

    const clientSecretPromptCount = (
      combinedOutput.match(/client_secret>/g) ?? []
    ).length;
    while (clientSecretPromptHandled < clientSecretPromptCount) {
      subprocess.stdin?.write("\n");
      clientSecretPromptHandled += 1;
    }

    const regionPromptCount = (combinedOutput.match(/region>/g) ?? []).length;
    while (regionPromptHandled < regionPromptCount) {
      subprocess.stdin?.write("1\n");
      regionPromptHandled += 1;
    }

    const tenantPromptCount = (combinedOutput.match(/tenant>/g) ?? []).length;
    while (tenantPromptHandled < tenantPromptCount) {
      subprocess.stdin?.write("\n");
      tenantPromptHandled += 1;
    }

    const advancedConfigPromptCount = (
      combinedOutput.match(/Edit advanced config\?[\s\S]*?y\/n>/gi) ?? []
    ).length;
    while (advancedConfigPromptHandled < advancedConfigPromptCount) {
      subprocess.stdin?.write("n\n");
      advancedConfigPromptHandled += 1;
    }

    const tokenRefreshPromptCount = (
      combinedOutput.match(
        /Already have a token\s*-\s*refresh\?[\s\S]*?y\/n>/gi,
      ) ?? []
    ).length;
    while (tokenRefreshPromptHandled < tokenRefreshPromptCount) {
      // Critical for edit flow: keep existing token and skip refresh browser auth.
      subprocess.stdin?.write("n\n");
      tokenRefreshPromptHandled += 1;
    }

    const browserPromptCount = (
      combinedOutput.match(
        /Use web browser to automatically authenticate rclone with remote\?[\s\S]*?y\/n>/gi,
      ) ?? []
    ).length;
    while (browserPromptHandled < browserPromptCount) {
      subprocess.stdin?.write("n\n");
      browserPromptHandled += 1;
    }

    const configTokenPromptCount = (
      combinedOutput.match(/config_token>/g) ?? []
    ).length;
    while (configTokenPromptHandled < configTokenPromptCount) {
      const tokenValue = tokenForConfigTokenPrompt?.trim() ?? "";
      subprocess.stdin?.write(`${tokenValue}\n`);
      configTokenPromptHandled += 1;
    }

    const configTypePromptCount = (combinedOutput.match(/config_type>/g) ?? [])
      .length;
    while (configTypePromptHandled < configTypePromptCount) {
      subprocess.stdin?.write("1\n");
      configTypePromptHandled += 1;
    }

    const configDriveIdPromptCount = (
      combinedOutput.match(/config_driveid>/g) ?? []
    ).length;
    while (configDriveIdPromptHandled < configDriveIdPromptCount) {
      const selectedValue =
        preferredChoice?.optionNumber ?? preferredDriveId ?? "";
      subprocess.stdin?.write(`${selectedValue}\n`);
      configDriveIdPromptHandled += 1;

      if (preferredChoice?.optionNumber) {
        deps.appendBackupLog(
          "info",
          `Using OneDrive drive option ${preferredChoice.optionNumber}${preferredChoice.label ? ` (${preferredChoice.label})` : ""}.`,
        );
      } else if (selectedValue) {
        deps.appendBackupLog(
          "info",
          "Using configured OneDrive drive ID value.",
        );
      }
    }

    const driveOkPromptCount = (combinedOutput.match(/Drive OK\?/gi) ?? [])
      .length;
    while (driveOkPromptHandled < driveOkPromptCount) {
      subprocess.stdin?.write("y\n");
      driveOkPromptHandled += 1;
    }

    const keepRemotePromptCount = (combinedOutput.match(/y\/e\/d>/gi) ?? [])
      .length;
    while (keepRemotePromptHandled < keepRemotePromptCount) {
      subprocess.stdin?.write("y\n");
      keepRemotePromptHandled += 1;
    }
  };

  await new Promise<void>((resolve, reject) => {
    const interactiveTimeout = setTimeout(() => {
      try {
        subprocess.kill();
      } catch {
        // Ignore kill failures; close/error handlers will finish the promise.
      }
    }, config.interactiveTimeoutMs);

    subprocess.stdout?.on("data", (chunk) => {
      stdoutText += Buffer.from(chunk).toString("utf8");
      tryRespondToPrompts();
    });

    subprocess.stderr?.on("data", (chunk) => {
      stderrText += Buffer.from(chunk).toString("utf8");
      tryRespondToPrompts();
    });

    subprocess.on("error", (error) => {
      clearTimeout(interactiveTimeout);
      reject(error);
    });

    subprocess.on("close", (code) => {
      clearTimeout(interactiveTimeout);
      if ((code ?? 0) === 0) {
        resolve();
        return;
      }

      const combined = deps.redactSensitiveText(
        `${stderrText}\n${stdoutText}`.trim(),
      );
      reject(
        new Error(
          combined ||
            `rclone config update failed with exit code ${String(code ?? 0)}`,
        ),
      );
    });
  });
}
