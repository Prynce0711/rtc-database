-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeName" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "position" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "tinNumber" TEXT,
    "gsisNumber" TEXT,
    "philHealthNumber" TEXT,
    "pagIbigNumber" TEXT,
    "birthDate" DATETIME NOT NULL,
    "bloodType" TEXT,
    "allergies" TEXT,
    "height" REAL,
    "weight" REAL,
    "contactPerson" TEXT NOT NULL,
    "contactNumber" TEXT,
    "email" TEXT
);
INSERT INTO "new_Employee" ("allergies", "birthDate", "bloodType", "branch", "contactNumber", "contactPerson", "email", "employeeName", "employeeNumber", "gsisNumber", "height", "id", "pagIbigNumber", "philHealthNumber", "position", "tinNumber", "weight") SELECT "allergies", "birthDate", "bloodType", "branch", "contactNumber", "contactPerson", "email", "employeeName", "employeeNumber", "gsisNumber", "height", "id", "pagIbigNumber", "philHealthNumber", "position", "tinNumber", "weight" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
