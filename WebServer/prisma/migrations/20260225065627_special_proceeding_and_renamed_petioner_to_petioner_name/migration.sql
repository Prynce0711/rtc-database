/*
  Warnings:

  - You are about to drop the column `petitionerName` on the `Petition` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "SpecialProceeding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    "respondent" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Petition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT
);
INSERT INTO "new_Petition" ("caseNumber", "date", "id", "nature", "raffledTo") SELECT "caseNumber", "date", "id", "nature", "raffledTo" FROM "Petition";
DROP TABLE "Petition";
ALTER TABLE "new_Petition" RENAME TO "Petition";
CREATE UNIQUE INDEX "Petition_caseNumber_key" ON "Petition"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SpecialProceeding_caseNumber_key" ON "SpecialProceeding"("caseNumber");
