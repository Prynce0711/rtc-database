import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma";

// If your Prisma file is located elsewhere, you can change the path
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL ?? "http://localhost:3000",
  trustedOrigins: ["http://localhost:5173", "http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "sqlite", // or "mysql", "postgresql", ...etc
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
      },
    },
  },
});
