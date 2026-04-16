-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeName" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
