-- CreateTable
CREATE TABLE "UnloadedCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "caseNumber" TEXT,
    "fromBranch" TEXT,
    "toBranch" TEXT,
    "dateTransmitted" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "UnloadedCase_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsolidatedCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "caseNumber" TEXT,
    "fromBranch" TEXT,
    "toBranch" TEXT,
    "dateTransmitted" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "ConsolidatedCase_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReraffledCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "caseNumber" TEXT,
    "fromBranch" TEXT,
    "toBranch" TEXT,
    "dateTransmitted" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "ReraffledCase_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UnloadedCase_baseCaseID_key" ON "UnloadedCase"("baseCaseID");

-- CreateIndex
CREATE UNIQUE INDEX "UnloadedCase_updatedAt_id_key" ON "UnloadedCase"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidatedCase_baseCaseID_key" ON "ConsolidatedCase"("baseCaseID");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidatedCase_updatedAt_id_key" ON "ConsolidatedCase"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReraffledCase_baseCaseID_key" ON "ReraffledCase"("baseCaseID");

-- CreateIndex
CREATE UNIQUE INDEX "ReraffledCase_updatedAt_id_key" ON "ReraffledCase"("updatedAt", "id");
