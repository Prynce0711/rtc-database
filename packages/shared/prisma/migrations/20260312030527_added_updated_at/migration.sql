-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Chat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL DEFAULT 'DIRECT',
    "name" TEXT,
    "description" TEXT,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Chat" ("createdAt", "description", "id", "lastMessageAt", "name", "type", "updatedAt") SELECT "createdAt", "description", "id", "lastMessageAt", "name", "type", "updatedAt" FROM "Chat";
DROP TABLE "Chat";
ALTER TABLE "new_Chat" RENAME TO "Chat";
CREATE TABLE "new_ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" INTEGER,
    CONSTRAINT "ChatMessage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileData" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatMessage" ("chatId", "content", "createdAt", "fileId", "id", "updatedAt", "userId") SELECT "chatId", "content", "createdAt", "fileId", "id", "updatedAt", "userId" FROM "ChatMessage";
DROP TABLE "ChatMessage";
ALTER TABLE "new_ChatMessage" RENAME TO "ChatMessage";
CREATE TABLE "new_CivilCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioners" TEXT,
    "defendants" TEXT,
    "notes" TEXT,
    "nature" TEXT,
    "originCaseNumber" TEXT,
    "reRaffleDate" DATETIME,
    "reRaffleBranch" TEXT,
    "consolitationDate" DATETIME,
    "consolidationBranch" TEXT,
    "dateRemanded" DATETIME,
    "remandedNote" TEXT,
    "undocketed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CivilCase_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CivilCase" ("caseNumber", "consolidationBranch", "consolitationDate", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "reRaffleBranch", "reRaffleDate", "remandedNote", "undocketed") SELECT "caseNumber", "consolidationBranch", "consolitationDate", "dateRemanded", "defendants", "id", "nature", "notes", "originCaseNumber", "petitioners", "reRaffleBranch", "reRaffleDate", "remandedNote", "undocketed" FROM "CivilCase";
DROP TABLE "CivilCase";
ALTER TABLE "new_CivilCase" RENAME TO "CivilCase";
CREATE UNIQUE INDEX "CivilCase_caseNumber_key" ON "CivilCase"("caseNumber");
CREATE TABLE "new_CriminalCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "charge" TEXT,
    "infoSheet" TEXT,
    "court" TEXT,
    "detained" TEXT,
    "consolidation" TEXT,
    "eqcNumber" INTEGER,
    "bond" TEXT,
    "raffleDate" DATETIME,
    "committee1" TEXT,
    "committee2" TEXT,
    "judge" TEXT,
    "ao" TEXT,
    "complainant" TEXT,
    "houseNo" TEXT,
    "street" TEXT,
    "barangay" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "counts" TEXT,
    "jdf" TEXT,
    "sajj" TEXT,
    "sajj2" TEXT,
    "mf" TEXT,
    "stf" TEXT,
    "lrf" TEXT,
    "vcf" TEXT,
    "total" TEXT,
    "amountInvolved" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CriminalCase_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CriminalCase" ("amountInvolved", "ao", "barangay", "bond", "caseNumber", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf") SELECT "amountInvolved", "ao", "barangay", "bond", "caseNumber", "charge", "committee1", "committee2", "complainant", "consolidation", "counts", "court", "createdAt", "detained", "eqcNumber", "houseNo", "id", "infoSheet", "jdf", "judge", "lrf", "mf", "municipality", "name", "province", "raffleDate", "sajj", "sajj2", "stf", "street", "total", "vcf" FROM "CriminalCase";
DROP TABLE "CriminalCase";
ALTER TABLE "new_CriminalCase" RENAME TO "CriminalCase";
CREATE UNIQUE INDEX "CriminalCase_caseNumber_key" ON "CriminalCase"("caseNumber");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Employee" ("birthDate", "branch", "contactNumber", "createdAt", "dateHired", "email", "employeeName", "employeeNumber", "employmentType", "id", "position") SELECT "birthDate", "branch", "contactNumber", "createdAt", "dateHired", "email", "employeeName", "employeeNumber", "employmentType", "id", "position" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE UNIQUE INDEX "Employee_contactNumber_key" ON "Employee"("contactNumber");
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE TABLE "new_FileData" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_FileData" ("createdAt", "fileName", "id", "key", "mimeType", "path", "size") SELECT "createdAt", "fileName", "id", "key", "mimeType", "path", "size" FROM "FileData";
DROP TABLE "FileData";
ALTER TABLE "new_FileData" RENAME TO "FileData";
CREATE UNIQUE INDEX "FileData_key_key" ON "FileData"("key");
CREATE TABLE "new_Log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Log" ("action", "createdAt", "details", "id", "ipAddress", "timestamp", "userAgent", "userId") SELECT "action", "createdAt", "details", "id", "ipAddress", "timestamp", "userAgent", "userId" FROM "Log";
DROP TABLE "Log";
ALTER TABLE "new_Log" RENAME TO "Log";
CREATE TABLE "new_Notarial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "name" TEXT,
    "attorney" TEXT,
    "date" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" INTEGER,
    CONSTRAINT "Notarial_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileData" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notarial" ("attorney", "createdAt", "date", "fileId", "id", "name", "title") SELECT "attorney", "createdAt", "date", "fileId", "id", "name", "title" FROM "Notarial";
DROP TABLE "Notarial";
ALTER TABLE "new_Notarial" RENAME TO "Notarial";
CREATE TABLE "new_Petition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitioner" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Petition_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_RecievingLog" ("bookAndPage", "branchNumber", "caseNumber", "caseType", "content", "createdAt", "dateRecieved", "id", "notes") SELECT "bookAndPage", "branchNumber", "caseNumber", "caseType", "content", "createdAt", "dateRecieved", "id", "notes" FROM "RecievingLog";
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialProceeding_caseNumber_fkey" FOREIGN KEY ("caseNumber") REFERENCES "Case" ("caseNumber") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SpecialProceeding" ("caseNumber", "date", "id", "nature", "petitioner", "raffledTo", "respondent") SELECT "caseNumber", "date", "id", "nature", "petitioner", "raffledTo", "respondent" FROM "SpecialProceeding";
DROP TABLE "SpecialProceeding";
ALTER TABLE "new_SpecialProceeding" RENAME TO "SpecialProceeding";
CREATE UNIQUE INDEX "SpecialProceeding_caseNumber_key" ON "SpecialProceeding"("caseNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
