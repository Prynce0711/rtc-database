-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CivilCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioners" TEXT NOT NULL,
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
    CONSTRAINT "CivilCase_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CivilCase" ("caseNumber", "consolidationBranch", "consolitationDate", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "reRaffleBranch", "reRaffleDate", "remandedNote") SELECT "caseNumber", "consolidationBranch", "consolitationDate", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "reRaffleBranch", "reRaffleDate", "remandedNote" FROM "CivilCase";
DROP TABLE "CivilCase";
ALTER TABLE "new_CivilCase" RENAME TO "CivilCase";
CREATE UNIQUE INDEX "CivilCase_caseNumber_key" ON "CivilCase"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
