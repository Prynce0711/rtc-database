-- CreateTable
CREATE TABLE "RecievingLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookAndPage" TEXT,
    "dateRecieved" DATETIME,
    "caseType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "caseNumber" TEXT,
    "content" TEXT,
    "branchNumber" TEXT,
    "notes" TEXT
);
