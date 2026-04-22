/*
  Warnings:

  - Added the required column `verified` to the `twoFactor` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_twoFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_twoFactor" ("backupCodes", "id", "secret", "userId") SELECT "backupCodes", "id", "secret", "userId" FROM "twoFactor";
DROP TABLE "twoFactor";
ALTER TABLE "new_twoFactor" RENAME TO "twoFactor";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
