/*
  Warnings:

  - You are about to drop the column `AO` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `AmountInvolved` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Barangay` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Complainant` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Counts` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `HouseNo` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Jdf` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Judge` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `LRF` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `MF` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Municipality` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Province` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `STF` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Sajj` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Sajj2` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Street` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `Total` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `VCF` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `committe1` on the `Case` table. All the data in the column will be lost.
  - You are about to drop the column `committe2` on the `Case` table. All the data in the column will be lost.

*/
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
INSERT INTO "new_Case" ("assistantBranch", "bond", "branch", "caseNumber", "caseType", "charge", "consolidation", "court", "createdAt", "dateFiled", "detained", "eqcNumber", "id", "infoSheet", "name", "raffleDate") SELECT "assistantBranch", "bond", "branch", "caseNumber", "caseType", "charge", "consolidation", "court", "createdAt", "dateFiled", "detained", "eqcNumber", "id", "infoSheet", "name", "raffleDate" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
