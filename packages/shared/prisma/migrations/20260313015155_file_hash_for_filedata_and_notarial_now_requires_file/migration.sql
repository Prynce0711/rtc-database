/*
  Warnings:

  - Added the required column `fileHash` to the `FileData` table without a default value. This is not possible if the table is not empty.
  - Made the column `fileId` on table `Notarial` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FileData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);
INSERT INTO "new_FileData" ("createdAt", "fileName", "id", "key", "mimeType", "path", "size", "updatedAt") SELECT "createdAt", "fileName", "id", "key", "mimeType", "path", "size", "updatedAt" FROM "FileData";
DROP TABLE "FileData";
ALTER TABLE "new_FileData" RENAME TO "FileData";
CREATE UNIQUE INDEX "FileData_key_key" ON "FileData"("key");
CREATE TABLE "new_Notarial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "name" TEXT,
    "attorney" TEXT,
    "date" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    "fileId" INTEGER NOT NULL,
    CONSTRAINT "Notarial_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileData" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Notarial" ("attorney", "createdAt", "date", "fileId", "id", "name", "title", "updatedAt") SELECT "attorney", "createdAt", "date", "fileId", "id", "name", "title", "updatedAt" FROM "Notarial";
DROP TABLE "Notarial";
ALTER TABLE "new_Notarial" RENAME TO "Notarial";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
