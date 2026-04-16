-- CreateTable
CREATE TABLE "annualTrialCourt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch" TEXT NOT NULL,
    "pendingLastYear" TEXT,
    "RaffledOrAdded" TEXT,
    "Disposed" TEXT,
    "pendingThisYear" TEXT,
    "percentageOfDisposition" TEXT
);

-- CreateTable
CREATE TABLE "inventoryDocument" (
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
