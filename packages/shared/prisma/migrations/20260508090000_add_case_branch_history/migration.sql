CREATE TABLE "CaseBranchHistory" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "baseCaseID" INTEGER NOT NULL,
  "eventType" TEXT NOT NULL DEFAULT 'BRANCH_UPDATE',
  "fromBranch" TEXT,
  "toBranch" TEXT,
  "raffleDate" DATETIME,
  "notes" TEXT,
  "source" TEXT,
  "fingerprint" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME,
  CONSTRAINT "CaseBranchHistory_baseCaseID_fkey"
    FOREIGN KEY ("baseCaseID") REFERENCES "Case" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CaseBranchHistory_fingerprint_key"
ON "CaseBranchHistory"("fingerprint");

CREATE INDEX "CaseBranchHistory_baseCaseID_idx"
ON "CaseBranchHistory"("baseCaseID");

CREATE INDEX "CaseBranchHistory_eventType_idx"
ON "CaseBranchHistory"("eventType");

CREATE INDEX "CaseBranchHistory_raffleDate_idx"
ON "CaseBranchHistory"("raffleDate");
