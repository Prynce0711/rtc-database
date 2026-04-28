-- CreateTable
CREATE TABLE "TransmittalRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "sourceRecordId" INTEGER NOT NULL,
    "caseNumber" TEXT,
    "branchLabel" TEXT,
    "transmittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "TransmittalRecord_category_sourceRecordId_key" ON "TransmittalRecord"("category", "sourceRecordId");

-- CreateIndex
CREATE INDEX "TransmittalRecord_category_transmittedAt_idx" ON "TransmittalRecord"("category", "transmittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransmittalRecord_updatedAt_id_key" ON "TransmittalRecord"("updatedAt", "id");
