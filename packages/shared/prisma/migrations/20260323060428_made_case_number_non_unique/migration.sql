/*
  Warnings:

  - You are about to drop the column `caseNumber` on the `CivilCase` table. All the data in the column will be lost.
  - You are about to drop the column `caseNumber` on the `CriminalCase` table. All the data in the column will be lost.
  - You are about to drop the column `caseNumber` on the `Petition` table. All the data in the column will be lost.
  - You are about to drop the column `caseNumber` on the `SpecialProceeding` table. All the data in the column will be lost.
  - Added the required column `baseCaseID` to the `CivilCase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseCaseID` to the `CriminalCase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseCaseID` to the `Petition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseCaseID` to the `SpecialProceeding` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Case_caseNumber_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CivilCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "petitioners" TEXT,
    "defendants" TEXT,
    "notes" TEXT,
    "nature" TEXT,
    "originCaseNumber" TEXT,
    "reRaffleDate" DATETIME,
    "reRaffleBranch" TEXT,
    "consolitationDate" DATETIME,
    "consolidationBranch" TEXT,
    "dateRemanded" DATETIME,
    "remandedNote" TEXT,
    "undocketed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "CivilCase_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CivilCase" ("consolidationBranch", "consolitationDate", "createdAt", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "reRaffleBranch", "reRaffleDate", "remandedNote", "undocketed", "updatedAt") SELECT "consolidationBranch", "consolitationDate", "createdAt", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "reRaffleBranch", "reRaffleDate", "remandedNote", "undocketed", "updatedAt" FROM "CivilCase";
DROP TABLE "CivilCase";
ALTER TABLE "new_CivilCase" RENAME TO "CivilCase";
CREATE UNIQUE INDEX "CivilCase_baseCaseID_key" ON "CivilCase"("baseCaseID");
CREATE TABLE "new_CriminalCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "charge" TEXT,
    "infoSheet" TEXT,
    "court" TEXT,
    "detained" TEXT,
    "consolidation" TEXT,
    "eqcNumber" TEXT,
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
    "updatedAt" DATETIME,
    CONSTRAINT "CriminalCase_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CriminalCase" ("amountInvolved", "ao", "barangay", "bond", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "updatedAt", "vcf") SELECT "amountInvolved", "ao", "barangay", "bond", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "updatedAt", "vcf" FROM "CriminalCase";
DROP TABLE "CriminalCase";
ALTER TABLE "new_CriminalCase" RENAME TO "CriminalCase";
CREATE UNIQUE INDEX "CriminalCase_baseCaseID_key" ON "CriminalCase"("baseCaseID");
CREATE TABLE "new_Petition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "Petition_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Petition" ("createdAt", "date", "id", "nature", "petitioner", "raffledTo", "updatedAt") SELECT "createdAt", "date", "id", "nature", "petitioner", "raffledTo", "updatedAt" FROM "Petition";
DROP TABLE "Petition";
ALTER TABLE "new_Petition" RENAME TO "Petition";
CREATE UNIQUE INDEX "Petition_baseCaseID_key" ON "Petition"("baseCaseID");
CREATE TABLE "new_SpecialProceeding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    "respondent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "SpecialProceeding_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SpecialProceeding" ("createdAt", "date", "id", "nature", "petitioner", "raffledTo", "respondent", "updatedAt") SELECT "createdAt", "date", "id", "nature", "petitioner", "raffledTo", "respondent", "updatedAt" FROM "SpecialProceeding";
DROP TABLE "SpecialProceeding";
ALTER TABLE "new_SpecialProceeding" RENAME TO "SpecialProceeding";
CREATE UNIQUE INDEX "SpecialProceeding_baseCaseID_key" ON "SpecialProceeding"("baseCaseID");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
