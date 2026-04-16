import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@rtc-database/shared/prisma/client";
import "dotenv/config";
import { env } from "prisma/config";

if (typeof window !== "undefined") {
  throw new Error("prisma/client should only be imported in server-side code");
}

const connectionString = env("DATABASE_URL") || "";
const adapter = new PrismaBetterSqlite3({ url: connectionString });

const prisma = new PrismaClient({ adapter });

export { prisma };
