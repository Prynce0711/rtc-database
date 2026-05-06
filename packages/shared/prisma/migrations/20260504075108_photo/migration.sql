-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeName" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "position" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "dateHired" DATETIME NOT NULL,
    "employmentType" TEXT NOT NULL,
    "contactNumber" TEXT,
    "email" TEXT,
    "imageFileId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "Employee_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "FileData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("birthDate", "branch", "contactNumber", "createdAt", "dateHired", "email", "employeeName", "employeeNumber", "employmentType", "id", "position", "updatedAt") SELECT "birthDate", "branch", "contactNumber", "createdAt", "dateHired", "email", "employeeName", "employeeNumber", "employmentType", "id", "position", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE UNIQUE INDEX "Employee_contactNumber_key" ON "Employee"("contactNumber");
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE UNIQUE INDEX "Employee_updatedAt_id_key" ON "Employee"("updatedAt", "id");
CREATE TABLE "new_NotarialCommission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "petition" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "termOfCommission" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "termStartYear" INTEGER,
    "termEndYear" INTEGER,
    "imageFileId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME,
    CONSTRAINT "NotarialCommission_imageFileId_fkey" FOREIGN KEY ("imageFileId") REFERENCES "FileData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_NotarialCommission" ("address", "createdAt", "id", "name", "petition", "termEndYear", "termOfCommission", "termStartYear", "updatedAt") SELECT "address", "createdAt", "id", "name", "petition", "termEndYear", "termOfCommission", "termStartYear", "updatedAt" FROM "NotarialCommission";
DROP TABLE "NotarialCommission";
ALTER TABLE "new_NotarialCommission" RENAME TO "NotarialCommission";
CREATE INDEX "NotarialCommission_termStartYear_termEndYear_idx" ON "NotarialCommission"("termStartYear", "termEndYear");
CREATE UNIQUE INDEX "NotarialCommission_updatedAt_id_key" ON "NotarialCommission"("updatedAt", "id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
