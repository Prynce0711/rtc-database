/*
  Warnings:

  - You are about to drop the column `filename` on the `FileData` table. All the data in the column will be lost.
  - Added the required column `fileName` to the `FileData` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FileData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_FileData" ("createdAt", "id", "mimeType", "path", "size") SELECT "createdAt", "id", "mimeType", "path", "size" FROM "FileData";
DROP TABLE "FileData";
ALTER TABLE "new_FileData" RENAME TO "FileData";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
