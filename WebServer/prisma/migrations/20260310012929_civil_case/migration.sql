-- CreateTable
CREATE TABLE "CivilCase" (
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
    CONSTRAINT "CivilCase_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CivilCase_caseNumber_key" ON "CivilCase"("caseNumber");
