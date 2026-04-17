-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "branch" TEXT NOT NULL,
    "assistantBranch" TEXT,
    "caseNumber" TEXT NOT NULL,
    "dateFiled" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "charge" TEXT NOT NULL,
    "infoSheet" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "detained" BOOLEAN NOT NULL,
    "consolidation" TEXT NOT NULL,
    "eqcNumber" INTEGER,
    "bond" TEXT,
    "raffleDate" DATETIME,
    "committee1" INTEGER,
    "committee2" INTEGER,
    "judge" TEXT,
    "ao" TEXT,
    "complainant" TEXT,
    "houseNo" TEXT,
    "street" TEXT,
    "barangay" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "counts" TEXT,
    "jdf" REAL,
    "sajj" REAL,
    "sajj2" REAL,
    "mf" REAL,
    "stf" REAL,
    "lrf" REAL,
    "vcf" REAL,
    "total" REAL,
    "amountInvolved" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Case" ("amountInvolved", "ao", "assistantBranch", "barangay", "bond", "branch", "caseNumber", "caseType", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "dateFiled", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf") SELECT "amountInvolved", "ao", "assistantBranch", "barangay", "bond", "branch", "caseNumber", "caseType", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "dateFiled", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
