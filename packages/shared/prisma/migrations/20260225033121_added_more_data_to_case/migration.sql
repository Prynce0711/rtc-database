-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "branch" TEXT NOT NULL,
    "assistantBranch" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "dateFiled" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "charge" TEXT NOT NULL,
    "infoSheet" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "detained" BOOLEAN NOT NULL,
    "consolidation" TEXT NOT NULL,
    "eqcNumber" INTEGER,
    "bond" REAL,
    "raffleDate" DATETIME,
    "committe1" INTEGER,
    "committe2" INTEGER,
    "Judge" TEXT,
    "AO" TEXT,
    "Complainant" TEXT,
    "HouseNo" TEXT,
    "Street" TEXT,
    "Barangay" TEXT,
    "Municipality" TEXT,
    "Province" TEXT,
    "Counts" TEXT,
    "Jdf" REAL,
    "Sajj" REAL,
    "Sajj2" REAL,
    "MF" REAL,
    "STF" REAL,
    "LRF" REAL,
    "VCF" REAL,
    "Total" REAL,
    "AmountInvolved" REAL
);
INSERT INTO "new_Case" ("assistantBranch", "bond", "branch", "caseNumber", "charge", "committe1", "committe2", "consolidation", "court", "dateFiled", "detained", "eqcNumber", "id", "infoSheet", "name", "raffleDate") SELECT "assistantBranch", "bond", "branch", "caseNumber", "charge", "committe1", "committe2", "consolidation", "court", "dateFiled", "detained", "eqcNumber", "id", "infoSheet", "name", "raffleDate" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
