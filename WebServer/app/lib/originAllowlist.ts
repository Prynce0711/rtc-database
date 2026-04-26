const DEFAULT_ORIGINS = [
  process.env.NEXT_PUBLIC_URL || "http://localhost:3000",
  process.env.NATIVE_APP_URL || "http://localhost:5173",
];

const parseCsv = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const tryParseOrigin = (raw: string): string | null => {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
};

const expandOriginEntry = (rawEntry: string): string[] => {
  const directOrigin = tryParseOrigin(rawEntry);
  if (directOrigin) {
    return [directOrigin];
  }

  const host = rawEntry
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    ?.trim();
  if (!host) {
    return [];
  }

  if (host.includes(":")) {
    return [`https://${host}`, `http://${host}`];
  }

  return [`https://${host}`, `http://${host}`];
};

export const getAllowedOrigins = (): string[] => {
  const origins = new Set<string>();

  for (const origin of DEFAULT_ORIGINS) {
    const normalized = tryParseOrigin(origin);
    if (normalized) {
      origins.add(normalized);
    }
  }

  for (const entry of parseCsv(process.env.NEXT_ALLOWED_ORIGINS)) {
    for (const expandedOrigin of expandOriginEntry(entry)) {
      const normalized = tryParseOrigin(expandedOrigin);
      if (normalized) {
        origins.add(normalized);
      }
    }
  }

  return [...origins];
};
