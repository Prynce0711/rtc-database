import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { app } from "electron";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";

if (typeof window !== "undefined") {
  throw new Error("prisma/client should only be imported in server-side code");
}

const getDatabaseUrl = (): string =>
  path.join(app.getPath("userData"), "database.sqlite");

const adapter = new PrismaBetterSqlite3({ url: getDatabaseUrl() });

// Use standard Prisma Client without adapter to avoid bundling issues
const prisma = new PrismaClient({ adapter });

export { prisma };
