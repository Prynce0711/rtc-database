import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["rclone.js"],
  crossOrigin: "anonymous",
  turbopack: {
    root: "..",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  allowedDevOrigins: ["http://127.0.0.1:3000", "http://192.168.100.113:3000"],
  async headers() {
    const nativeOrigin = process.env.NATIVE_APP_URL || "http://localhost:5173";

    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: nativeOrigin,
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With",
          },
          {
            key: "Vary",
            value: "Origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
