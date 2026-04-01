/*
  Warnings:

  - You are about to drop the column `otp` on the `user` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CaseCounter" (
    "caseType" TEXT NOT NULL DEFAULT 'CRIMINAL',
    "area" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("caseType", "area", "year")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "branch" TEXT,
    "assistantBranch" TEXT,
    "caseNumber" TEXT NOT NULL,
    "number" INTEGER,
    "area" TEXT,
    "year" INTEGER,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "dateFiled" DATETIME
);
INSERT INTO "new_Case" ("assistantBranch", "branch", "caseNumber", "caseType", "dateFiled", "id") SELECT "assistantBranch", "branch", "caseNumber", "caseType", "dateFiled", "id" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseType_year_area_number_key" ON "Case"("caseType", "year", "area", "number");
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" DATETIME,
    "branch" TEXT,
    "darkMode" BOOLEAN DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "twoFactorEnabled" BOOLEAN DEFAULT false
);
INSERT INTO "new_user" ("banExpires", "banReason", "banned", "branch", "createdAt", "darkMode", "email", "emailVerified", "id", "image", "name", "role", "status", "updatedAt") SELECT "banExpires", "banReason", "banned", "branch", "createdAt", "darkMode", "email", "emailVerified", "id", "image", "name", "role", "status", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CaseCounter_area_year_idx" ON "CaseCounter"("area", "year");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");
