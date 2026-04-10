-- CreateTable
CREATE TABLE "SummaryStatistic" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "courtType" TEXT NOT NULL,
    "reportYear" INTEGER NOT NULL,
    "branch" TEXT NOT NULL,
    "raffleDate" DATETIME NOT NULL,
    "civilFamily" INTEGER NOT NULL DEFAULT 0,
    "civilOrdinary" INTEGER NOT NULL DEFAULT 0,
    "civilReceivedViaReraffled" INTEGER NOT NULL DEFAULT 0,
    "civilUnloaded" INTEGER NOT NULL DEFAULT 0,
    "lrcPetition" INTEGER NOT NULL DEFAULT 0,
    "lrcSpProc" INTEGER NOT NULL DEFAULT 0,
    "lrcReceivedViaReraffled" INTEGER NOT NULL DEFAULT 0,
    "lrcUnloaded" INTEGER NOT NULL DEFAULT 0,
    "criminalFamily" INTEGER NOT NULL DEFAULT 0,
    "criminalDrugs" INTEGER NOT NULL DEFAULT 0,
    "criminalOrdinary" INTEGER NOT NULL DEFAULT 0,
    "criminalReceivedViaReraffled" INTEGER NOT NULL DEFAULT 0,
    "criminalUnloaded" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "SummaryStatistic_reportYear_courtType_idx" ON "SummaryStatistic"("reportYear", "courtType");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryStatistic_courtType_branch_raffleDate_key" ON "SummaryStatistic"("courtType", "branch", "raffleDate");
