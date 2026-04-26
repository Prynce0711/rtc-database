import type { NextConfig } from "next";
import path from "path";

const allowedDevOrigins = new Set(["localhost", "127.0.0.1"]);
const allowedServerActionOrigins = new Set([
  "localhost:3000",
  "localhost:3443",
  "127.0.0.1:3000",
  "127.0.0.1:3443",
]);

const parseOriginEntries = (rawList: string | undefined): string[] =>
  (rawList ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const addOriginHost = (rawUrl: string | undefined) => {
  if (!rawUrl) {
    return;
  }

  try {
    const parsed = new URL(rawUrl);
    allowedDevOrigins.add(parsed.hostname);
    allowedServerActionOrigins.add(parsed.host);
  } catch {
    // Ignore malformed URLs in environment configuration.
  }
};

const addOriginEntry = (rawEntry: string) => {
  if (!rawEntry) {
    return;
  }

  try {
    const parsed = new URL(rawEntry);
    allowedDevOrigins.add(parsed.hostname);
    allowedServerActionOrigins.add(parsed.host);
    return;
  } catch {
    // Fall through and treat as host[:port] or wildcard host pattern.
  }

  const withoutScheme = rawEntry.replace(/^https?:\/\//i, "");
  const strippedPath = withoutScheme.split("/")[0] ?? "";
  const normalized = strippedPath.trim();
  if (!normalized) {
    return;
  }

  const [devHost] = normalized.split(":");
  if (devHost) {
    allowedDevOrigins.add(devHost);
  }

  allowedServerActionOrigins.add(normalized);
};

addOriginHost(process.env.NEXT_PUBLIC_URL);
addOriginHost(process.env.NATIVE_APP_URL);

for (const entry of parseOriginEntries(process.env.NEXT_ALLOWED_ORIGINS)) {
  addOriginEntry(entry);
}

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["rclone.js"],
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
      allowedOrigins: [...allowedServerActionOrigins],
    },
    proxyClientMaxBodySize: "50mb",
  },
  allowedDevOrigins: [...allowedDevOrigins],
};

export default nextConfig;
