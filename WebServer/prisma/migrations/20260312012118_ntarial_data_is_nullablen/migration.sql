-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notarial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "name" TEXT,
    "attorney" TEXT,
    "date" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" INTEGER,
    CONSTRAINT "Notarial_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notarial" ("attorney", "createdAt", "date", "fileId", "id", "name", "title") SELECT "attorney", "createdAt", "date", "fileId", "id", "name", "title" FROM "Notarial";
DROP TABLE "Notarial";
ALTER TABLE "new_Notarial" RENAME TO "Notarial";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
