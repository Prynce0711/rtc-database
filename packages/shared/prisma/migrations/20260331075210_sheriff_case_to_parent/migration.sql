-- CreateTable
CREATE TABLE "SheriffCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseCaseID" INTEGER NOT NULL,
    "mortgagee" TEXT,
    "mortgagor" TEXT,
    "remarks" TEXT,
    "sheriffName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "SheriffCase_baseCaseID_fkey" FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaseCounter" (
    "caseType" TEXT NOT NULL DEFAULT 'CRIMINAL',
    "area" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("caseType", "area", "year")
);
INSERT INTO "new_CaseCounter" ("area", "caseType", "createdAt", "last", "updatedAt", "year") SELECT "area", "caseType", "createdAt", "last", "updatedAt", "year" FROM "CaseCounter";
DROP TABLE "CaseCounter";
ALTER TABLE "new_CaseCounter" RENAME TO "CaseCounter";
CREATE INDEX "CaseCounter_area_year_idx" ON "CaseCounter"("area", "year");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SheriffCase_baseCaseID_key" ON "SheriffCase"("baseCaseID");
