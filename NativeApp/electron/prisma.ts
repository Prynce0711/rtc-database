import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@rtc-database/shared/prisma/client";
import { getDatabasePath } from "./databasePath";

if (typeof window !== "undefined") {
  throw new Error("prisma/client should only be imported in server-side code");
}

export const getDatabaseUrl = (): string => getDatabasePath();

const adapter = new PrismaBetterSqlite3({ url: getDatabaseUrl() });

// Use standard Prisma Client without adapter to avoid bundling issues
const prisma = new PrismaClient({ adapter });

export { prisma };
