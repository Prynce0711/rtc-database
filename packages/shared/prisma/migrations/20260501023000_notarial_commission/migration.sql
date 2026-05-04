-- CreateTable
CREATE TABLE "NotarialCommission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "petition" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "termOfCommission" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "termStartYear" INTEGER,
    "termEndYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "NotarialCommission_termStartYear_termEndYear_idx" ON "NotarialCommission"("termStartYear", "termEndYear");

-- CreateIndex
CREATE UNIQUE INDEX "NotarialCommission_updatedAt_id_key" ON "NotarialCommission"("updatedAt", "id");
