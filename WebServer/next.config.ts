import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: "..",
  },
  allowedDevOrigins: ["http://127.0.0.1:3000"],
};

export default nextConfig;
