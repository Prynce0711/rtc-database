/*
  Warnings:

  - You are about to drop the `annualTrialCourt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `inventoryDocument` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "annualTrialCourt";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "inventoryDocument";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AnnualTrialCourt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch" TEXT NOT NULL,
    "pendingLastYear" TEXT,
    "RaffledOrAdded" TEXT,
    "Disposed" TEXT,
    "pendingThisYear" TEXT,
    "percentageOfDisposition" TEXT
);

-- CreateTable
CREATE TABLE "InventoryDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "region" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "cityMunicipality" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "civilSmallClaimsFiled" TEXT,
    "criminalCasesFiled" TEXT,
    "civilSmallClaimsDisposed" TEXT,
    "criminalCasesDisposed" TEXT,
    "dateRecorded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
