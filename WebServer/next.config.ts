import type { NextConfig } from "next";
import path from "path";

const allowedDevOrigins = new Set(["localhost", "127.0.0.1"]);

try {
  const configuredDevHost = process.env.NEXT_PUBLIC_URL
    ? new URL(process.env.NEXT_PUBLIC_URL).hostname
    : undefined;
  if (configuredDevHost) {
    allowedDevOrigins.add(configuredDevHost);
  }
} catch {
  // Ignore malformed NEXT_PUBLIC_URL in local development.
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
    },
    proxyClientMaxBodySize: "50mb",
  },
  allowedDevOrigins: [...allowedDevOrigins],
};

export default nextConfig;
