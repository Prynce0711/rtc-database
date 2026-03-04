/*
  Warnings:

  - You are about to drop the column `allergies` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `bloodType` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `contactPerson` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `gsisNumber` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `height` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `pagIbigNumber` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `philHealthNumber` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `tinNumber` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `Employee` table. All the data in the column will be lost.
  - Added the required column `dateHired` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employmentStatus` to the `Employee` table without a default value. This is not possible if the table is not empty.

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
    "employmentStatus" TEXT NOT NULL,
    "retirementEligibility" BOOLEAN,
    "contactNumber" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Employee" ("birthDate", "branch", "contactNumber", "createdAt", "email", "employeeName", "employeeNumber", "id", "position") SELECT "birthDate", "branch", "contactNumber", "createdAt", "email", "employeeName", "employeeNumber", "id", "position" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE UNIQUE INDEX "Employee_contactNumber_key" ON "Employee"("contactNumber");
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
