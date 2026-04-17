-- AlterTable
ALTER TABLE "MunicipalTrialCourt" ADD COLUMN "reportYear" INTEGER;

-- AlterTable
ALTER TABLE "RegionalTrialCourt" ADD COLUMN "reportYear" INTEGER;

-- CreateIndex
CREATE INDEX "MunicipalTrialCourt_reportYear_idx" ON "MunicipalTrialCourt"("reportYear");

-- CreateIndex
CREATE INDEX "RegionalTrialCourt_reportYear_idx" ON "RegionalTrialCourt"("reportYear");
