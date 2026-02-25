-- CreateTable
CREATE TABLE "Petition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT NOT NULL,
    "petitionerName" TEXT,
    "raffledTo" TEXT,
    "date" DATETIME,
    "nature" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Petition_caseNumber_key" ON "Petition"("caseNumber");
