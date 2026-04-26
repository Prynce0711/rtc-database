/*
  Warnings:

  - You are about to drop the column `consolidationBranch` on the `CivilCase` table. All the data in the column will be lost.
  - You are about to drop the column `consolitationDate` on the `CivilCase` table. All the data in the column will be lost.
  - You are about to drop the column `reRaffleBranch` on the `CivilCase` table. All the data in the column will be lost.
  - You are about to drop the column `reRaffleDate` on the `CivilCase` table. All the data in the column will be lost.

*/
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
    "dateRemanded" DATETIME,
    "remandedNote" TEXT,
    "undocketed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "CivilCase_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CivilCase" ("baseCaseID", "createdAt", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "remandedNote", "undocketed", "updatedAt") SELECT "baseCaseID", "createdAt", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "remandedNote", "undocketed", "updatedAt" FROM "CivilCase";
DROP TABLE "CivilCase";
ALTER TABLE "new_CivilCase" RENAME TO "CivilCase";
CREATE UNIQUE INDEX "CivilCase_baseCaseID_key" ON "CivilCase"("baseCaseID");
CREATE UNIQUE INDEX "CivilCase_updatedAt_id_key" ON "CivilCase"("updatedAt", "id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
