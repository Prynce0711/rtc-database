/*
  Warnings:

  - You are about to drop the column `amountInvolved` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `ao` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `barangay` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `bond` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `charge` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `committee1` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `committee2` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `complainant` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `consolidation` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `counts` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `court` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `detained` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `eqcNumber` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `houseNo` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `infoSheet` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `jdf` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `judge` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `lrf` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `mf` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `municipality` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `province` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `raffleDate` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `sajj` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `sajj2` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `stf` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `street` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `total` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `vcf` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Petition` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `SpecialProceeding` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CriminalCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "charge" TEXT,
    "infoSheet" TEXT,
    "court" TEXT,
    "detained" TEXT,
    "consolidation" TEXT,
    "eqcNumber" INTEGER,
    "bond" TEXT,
    "raffleDate" DATETIME,
    "committee1" TEXT,
    "committee2" TEXT,
    "judge" TEXT,
    "ao" TEXT,
    "complainant" TEXT,
    "houseNo" TEXT,
    "street" TEXT,
    "barangay" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "counts" TEXT,
    "jdf" TEXT,
    "sajj" TEXT,
    "sajj2" TEXT,
    "mf" TEXT,
    "stf" TEXT,
    "lrf" TEXT,
    "vcf" TEXT,
    "total" TEXT,
    "amountInvolved" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CriminalCase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "dateFiled" DATETIME
);
INSERT INTO "new_Case" ("assistantBranch", "branch", "caseNumber", "caseType", "dateFiled", "id") SELECT "assistantBranch", "branch", "caseNumber", "caseType", "dateFiled", "id" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
CREATE TABLE "new_Petition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    CONSTRAINT "Petition_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Petition" ("caseNumber", "date", "id", "nature", "petitioner", "raffledTo") SELECT "caseNumber", "date", "id", "nature", "petitioner", "raffledTo" FROM "Petition";
DROP TABLE "Petition";
ALTER TABLE "new_Petition" RENAME TO "Petition";
CREATE UNIQUE INDEX "Petition_caseNumber_key" ON "Petition"("caseNumber");
CREATE TABLE "new_SpecialProceeding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    "respondent" TEXT,
    CONSTRAINT "SpecialProceeding_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SpecialProceeding" ("caseNumber", "date", "id", "nature", "petitioner", "raffledTo", "respondent") SELECT "caseNumber", "date", "id", "nature", "petitioner", "raffledTo", "respondent" FROM "SpecialProceeding";
DROP TABLE "SpecialProceeding";
ALTER TABLE "new_SpecialProceeding" RENAME TO "SpecialProceeding";
CREATE UNIQUE INDEX "SpecialProceeding_caseNumber_key" ON "SpecialProceeding"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CriminalCase_caseId_key" ON "CriminalCase"("caseId");
