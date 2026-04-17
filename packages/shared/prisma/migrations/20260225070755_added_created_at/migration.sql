-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "branch" TEXT NOT NULL,
    "assistantBranch" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "dateFiled" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "charge" TEXT NOT NULL,
    "infoSheet" TEXT NOT NULL,
    "court" TEXT NOT NULL,
    "detained" BOOLEAN NOT NULL,
    "consolidation" TEXT NOT NULL,
    "eqcNumber" INTEGER,
    "bond" REAL,
    "raffleDate" DATETIME,
    "committe1" INTEGER,
    "committe2" INTEGER,
    "Judge" TEXT,
    "AO" TEXT,
    "Complainant" TEXT,
    "HouseNo" TEXT,
    "Street" TEXT,
    "Barangay" TEXT,
    "Municipality" TEXT,
    "Province" TEXT,
    "Counts" TEXT,
    "Jdf" REAL,
    "Sajj" REAL,
    "Sajj2" REAL,
    "MF" REAL,
    "STF" REAL,
    "LRF" REAL,
    "VCF" REAL,
    "Total" REAL,
    "AmountInvolved" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Case" ("AO", "AmountInvolved", "Barangay", "Complainant", "Counts", "HouseNo", "Jdf", "Judge", "LRF", "MF", "Municipality", "Province", "STF", "Sajj", "Sajj2", "Street", "Total", "VCF", "assistantBranch", "bond", "branch", "caseNumber", "caseType", "charge", "committe1", "committe2", "consolidation", "court", "dateFiled", "detained", "eqcNumber", "id", "infoSheet", "name", "raffleDate") SELECT "AO", "AmountInvolved", "Barangay", "Complainant", "Counts", "HouseNo", "Jdf", "Judge", "LRF", "MF", "Municipality", "Province", "STF", "Sajj", "Sajj2", "Street", "Total", "VCF", "assistantBranch", "bond", "branch", "caseNumber", "caseType", "charge", "committe1", "committe2", "consolidation", "court", "dateFiled", "detained", "eqcNumber", "id", "infoSheet", "name", "raffleDate" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
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
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Employee" ("allergies", "birthDate", "bloodType", "branch", "contactNumber", "contactPerson", "email", "employeeName", "employeeNumber", "gsisNumber", "height", "id", "pagIbigNumber", "philHealthNumber", "position", "tinNumber", "weight") SELECT "allergies", "birthDate", "bloodType", "branch", "contactNumber", "contactPerson", "email", "employeeName", "employeeNumber", "gsisNumber", "height", "id", "pagIbigNumber", "philHealthNumber", "position", "tinNumber", "weight" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE TABLE "new_Log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Log" ("action", "details", "id", "ipAddress", "timestamp", "userAgent", "userId") SELECT "action", "details", "id", "ipAddress", "timestamp", "userAgent", "userId" FROM "Log";
DROP TABLE "Log";
ALTER TABLE "new_Log" RENAME TO "Log";
CREATE TABLE "new_Petition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Petition" ("caseNumber", "date", "id", "nature", "petitioner", "raffledTo") SELECT "caseNumber", "date", "id", "nature", "petitioner", "raffledTo" FROM "Petition";
DROP TABLE "Petition";
ALTER TABLE "new_Petition" RENAME TO "Petition";
CREATE UNIQUE INDEX "Petition_caseNumber_key" ON "Petition"("caseNumber");
CREATE TABLE "new_RecievingLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookAndPage" TEXT,
    "dateRecieved" DATETIME,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "caseNumber" TEXT,
    "content" TEXT,
    "branchNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RecievingLog" ("bookAndPage", "branchNumber", "caseNumber", "caseType", "content", "dateRecieved", "id", "notes") SELECT "bookAndPage", "branchNumber", "caseNumber", "caseType", "content", "dateRecieved", "id", "notes" FROM "RecievingLog";
DROP TABLE "RecievingLog";
ALTER TABLE "new_RecievingLog" RENAME TO "RecievingLog";
CREATE TABLE "new_SpecialProceeding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    "respondent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SpecialProceeding" ("caseNumber", "date", "id", "nature", "petitioner", "raffledTo", "respondent") SELECT "caseNumber", "date", "id", "nature", "petitioner", "raffledTo", "respondent" FROM "SpecialProceeding";
DROP TABLE "SpecialProceeding";
ALTER TABLE "new_SpecialProceeding" RENAME TO "SpecialProceeding";
CREATE UNIQUE INDEX "SpecialProceeding_caseNumber_key" ON "SpecialProceeding"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
