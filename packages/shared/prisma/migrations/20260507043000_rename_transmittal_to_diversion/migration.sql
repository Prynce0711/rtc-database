-- Rename diversion backing tables from Transmittal terminology.
PRAGMA foreign_keys=off;

ALTER TABLE "CriminalTransmittal" RENAME TO "CriminalDiversion";
ALTER TABLE "CivilTransmittal" RENAME TO "CivilDiversion";
ALTER TABLE "RecievingLogTransmittal" RENAME TO "RecievingLogDiversion";
ALTER TABLE "SheriffTransmittal" RENAME TO "SheriffDiversion";
ALTER TABLE "SpecialProceedingTransmittal" RENAME TO "SpecialProceedingDiversion";

DROP INDEX IF EXISTS "CriminalTransmittal_transmittedAt_idx";
DROP INDEX IF EXISTS "CriminalTransmittal_sourceRecordId_key";
DROP INDEX IF EXISTS "CriminalTransmittal_updatedAt_id_key";
DROP INDEX IF EXISTS "CivilTransmittal_transmittedAt_idx";
DROP INDEX IF EXISTS "CivilTransmittal_sourceRecordId_key";
DROP INDEX IF EXISTS "CivilTransmittal_updatedAt_id_key";
DROP INDEX IF EXISTS "RecievingLogTransmittal_transmittedAt_idx";
DROP INDEX IF EXISTS "RecievingLogTransmittal_sourceRecordId_key";
DROP INDEX IF EXISTS "RecievingLogTransmittal_updatedAt_id_key";
DROP INDEX IF EXISTS "SheriffTransmittal_transmittedAt_idx";
DROP INDEX IF EXISTS "SheriffTransmittal_sourceRecordId_key";
DROP INDEX IF EXISTS "SheriffTransmittal_updatedAt_id_key";
DROP INDEX IF EXISTS "SpecialProceedingTransmittal_transmittedAt_idx";
DROP INDEX IF EXISTS "SpecialProceedingTransmittal_sourceRecordId_key";
DROP INDEX IF EXISTS "SpecialProceedingTransmittal_updatedAt_id_key";

CREATE INDEX "CriminalDiversion_transmittedAt_idx" ON "CriminalDiversion"("transmittedAt");
CREATE UNIQUE INDEX "CriminalDiversion_sourceRecordId_key" ON "CriminalDiversion"("sourceRecordId");
CREATE UNIQUE INDEX "CriminalDiversion_updatedAt_id_key" ON "CriminalDiversion"("updatedAt", "id");

CREATE INDEX "CivilDiversion_transmittedAt_idx" ON "CivilDiversion"("transmittedAt");
CREATE UNIQUE INDEX "CivilDiversion_sourceRecordId_key" ON "CivilDiversion"("sourceRecordId");
CREATE UNIQUE INDEX "CivilDiversion_updatedAt_id_key" ON "CivilDiversion"("updatedAt", "id");

CREATE INDEX "RecievingLogDiversion_transmittedAt_idx" ON "RecievingLogDiversion"("transmittedAt");
CREATE UNIQUE INDEX "RecievingLogDiversion_sourceRecordId_key" ON "RecievingLogDiversion"("sourceRecordId");
CREATE UNIQUE INDEX "RecievingLogDiversion_updatedAt_id_key" ON "RecievingLogDiversion"("updatedAt", "id");

CREATE INDEX "SheriffDiversion_transmittedAt_idx" ON "SheriffDiversion"("transmittedAt");
CREATE UNIQUE INDEX "SheriffDiversion_sourceRecordId_key" ON "SheriffDiversion"("sourceRecordId");
CREATE UNIQUE INDEX "SheriffDiversion_updatedAt_id_key" ON "SheriffDiversion"("updatedAt", "id");

CREATE INDEX "SpecialProceedingDiversion_transmittedAt_idx" ON "SpecialProceedingDiversion"("transmittedAt");
CREATE UNIQUE INDEX "SpecialProceedingDiversion_sourceRecordId_key" ON "SpecialProceedingDiversion"("sourceRecordId");
CREATE UNIQUE INDEX "SpecialProceedingDiversion_updatedAt_id_key" ON "SpecialProceedingDiversion"("updatedAt", "id");

PRAGMA foreign_keys=on;
