import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@rtc-database/shared/prisma/client";
import Database from "better-sqlite3";
import "dotenv/config";
import { env } from "prisma/config";

if (typeof window !== "undefined") {
  throw new Error("prisma/client should only be imported in server-side code");
}

const connectionString = env("DATABASE_URL") || "";
const sqlite = new Database(connectionString, { fileMustExist: true });

// run BEFORE Prisma ever touches DB
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");

const adapter = new PrismaBetterSqlite3({ url: connectionString });

const prisma = new PrismaClient({ adapter });

async function init() {
  await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
  await prisma.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
  await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000;`);
}

init();

export { prisma };
