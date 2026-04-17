/*
  Warnings:

  - You are about to drop the column `caseId` on the `CriminalCase` table. All the data in the column will be lost.
  - Added the required column `caseNumber` to the `CriminalCase` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CriminalCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CriminalCase_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CriminalCase" ("amountInvolved", "ao", "barangay", "bond", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf") SELECT "amountInvolved", "ao", "barangay", "bond", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf" FROM "CriminalCase";
DROP TABLE "CriminalCase";
ALTER TABLE "new_CriminalCase" RENAME TO "CriminalCase";
CREATE UNIQUE INDEX "CriminalCase_caseNumber_key" ON "CriminalCase"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
