-- AlterTable
ALTER TABLE "user" ADD COLUMN "tutorialStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "user" ADD COLUMN "tutorialCompletedAt" DATETIME;
ALTER TABLE "user" ADD COLUMN "tutorialSkippedAt" DATETIME;
ALTER TABLE "user" ADD COLUMN "tutorialLastStartedAt" DATETIME;
