/*
  Warnings:

  - You are about to drop the column `employmentStatus` on the `Employee` table. All the data in the column will be lost.
  - Added the required column `employmentType` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
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
    "retirementEligibility" BOOLEAN,
    "contactNumber" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Employee" ("birthDate", "branch", "contactNumber", "createdAt", "dateHired", "email", "employeeName", "employeeNumber", "id", "position", "retirementEligibility") SELECT "birthDate", "branch", "contactNumber", "createdAt", "dateHired", "email", "employeeName", "employeeNumber", "id", "position", "retirementEligibility" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE UNIQUE INDEX "Employee_contactNumber_key" ON "Employee"("contactNumber");
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
