-- CreateTable
CREATE TABLE "ArchiveEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parentPath" TEXT NOT NULL DEFAULT '',
    "fullPath" TEXT NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'FILE',
    "description" TEXT,
    "extension" TEXT,
    "textContent" TEXT,
    "sheetData" JSONB,
    "fileId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "ArchiveEntry_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveEntry_fullPath_key" ON "ArchiveEntry"("fullPath");

-- CreateIndex
CREATE INDEX "ArchiveEntry_parentPath_entryType_name_idx" ON "ArchiveEntry"("parentPath", "entryType", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveEntry_parentPath_name_key" ON "ArchiveEntry"("parentPath", "name");
