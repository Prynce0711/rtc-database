/*
  Warnings:

  - You are about to drop the `TransmittalRecord` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "TransmittalRecord";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CriminalTransmittal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceRecordId" INTEGER NOT NULL,
    "caseNumber" TEXT,
    "branchLabel" TEXT,
    "transmittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CivilTransmittal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceRecordId" INTEGER NOT NULL,
    "caseNumber" TEXT,
    "branchLabel" TEXT,
    "transmittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RecievingLogTransmittal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceRecordId" INTEGER NOT NULL,
    "caseNumber" TEXT,
    "branchLabel" TEXT,
    "transmittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SheriffTransmittal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceRecordId" INTEGER NOT NULL,
    "caseNumber" TEXT,
    "branchLabel" TEXT,
    "transmittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SpecialProceedingTransmittal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceRecordId" INTEGER NOT NULL,
    "caseNumber" TEXT,
    "branchLabel" TEXT,
    "transmittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "CriminalTransmittal_transmittedAt_idx" ON "CriminalTransmittal"("transmittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CriminalTransmittal_sourceRecordId_key" ON "CriminalTransmittal"("sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CriminalTransmittal_updatedAt_id_key" ON "CriminalTransmittal"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "CivilTransmittal_transmittedAt_idx" ON "CivilTransmittal"("transmittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CivilTransmittal_sourceRecordId_key" ON "CivilTransmittal"("sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CivilTransmittal_updatedAt_id_key" ON "CivilTransmittal"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "RecievingLogTransmittal_transmittedAt_idx" ON "RecievingLogTransmittal"("transmittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecievingLogTransmittal_sourceRecordId_key" ON "RecievingLogTransmittal"("sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "RecievingLogTransmittal_updatedAt_id_key" ON "RecievingLogTransmittal"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "SheriffTransmittal_transmittedAt_idx" ON "SheriffTransmittal"("transmittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SheriffTransmittal_sourceRecordId_key" ON "SheriffTransmittal"("sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "SheriffTransmittal_updatedAt_id_key" ON "SheriffTransmittal"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "SpecialProceedingTransmittal_transmittedAt_idx" ON "SpecialProceedingTransmittal"("transmittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialProceedingTransmittal_sourceRecordId_key" ON "SpecialProceedingTransmittal"("sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialProceedingTransmittal_updatedAt_id_key" ON "SpecialProceedingTransmittal"("updatedAt", "id");
