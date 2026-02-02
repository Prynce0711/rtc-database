import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import "dotenv/config";
import { env } from "prisma/config";
import { PrismaClient } from "../generated/prisma/client";

if (typeof window !== "undefined") {
  throw new Error("prisma/client should only be imported in server-side code");
}

const connectionString = env("DATABASE_URL") || "";
const adapter = new PrismaBetterSqlite3({ url: connectionString });

// Use standard Prisma Client without adapter to avoid bundling issues
const prisma = new PrismaClient({ adapter });

export { prisma };
