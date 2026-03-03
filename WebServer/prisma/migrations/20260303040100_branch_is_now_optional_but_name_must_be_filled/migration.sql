/*
  Warnings:

  - Made the column `name` on table `Case` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "branch" TEXT,
    "assistantBranch" TEXT,
    "caseNumber" TEXT NOT NULL,
    "dateFiled" DATETIME,
    "name" TEXT NOT NULL,
    "charge" TEXT,
    "infoSheet" TEXT,
    "court" TEXT,
    "detained" TEXT,
    "consolidation" TEXT,
    "eqcNumber" INTEGER,
    "bond" TEXT,
    "raffleDate" DATETIME,
    "committee1" TEXT,
    "committee2" TEXT,
    "judge" TEXT,
    "ao" TEXT,
    "complainant" TEXT,
    "houseNo" TEXT,
    "street" TEXT,
    "barangay" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "counts" TEXT,
    "jdf" TEXT,
    "sajj" TEXT,
    "sajj2" TEXT,
    "mf" TEXT,
    "stf" TEXT,
    "lrf" TEXT,
    "vcf" TEXT,
    "total" TEXT,
    "amountInvolved" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Case" ("amountInvolved", "ao", "assistantBranch", "barangay", "bond", "branch", "caseNumber", "caseType", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "dateFiled", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf") SELECT "amountInvolved", "ao", "assistantBranch", "barangay", "bond", "branch", "caseNumber", "caseType", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "dateFiled", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
