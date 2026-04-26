import type { NextConfig } from "next";
import path from "path";

const allowedDevOrigins = new Set(["localhost", "127.0.0.1"]);
const allowedServerActionOrigins = new Set([
  "localhost:3000",
  "localhost:3443",
  "127.0.0.1:3000",
  "127.0.0.1:3443",
]);

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

addOriginHost(process.env.NEXT_PUBLIC_URL);
addOriginHost(process.env.NATIVE_APP_URL);

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
