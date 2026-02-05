-- CreateTable
CREATE TABLE "Case" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch" TEXT NOT NULL,
    "assistantBranch" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "dateFiled" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "charge" TEXT NOT NULL,
    "infoSheet" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "detained" BOOLEAN NOT NULL,
    "consolidation" TEXT NOT NULL,
    "eqcNumber" INTEGER,
    "bond" REAL NOT NULL,
    "raffleDate" DATETIME,
    "committe1" INTEGER,
    "committe2" INTEGER
);

-- CreateIndex
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
