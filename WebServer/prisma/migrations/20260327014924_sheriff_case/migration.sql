-- CreateTable
CREATE TABLE "Sherriff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ejfCaseNumber" TEXT,
    "mortgagee" TEXT,
    "mortgagor" TEXT,
    "remarks" TEXT,
    "date" DATETIME,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
);
