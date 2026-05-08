CREATE TABLE "CivilCourtOfFirstInstanceTransmittal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT,
    "branchJudge" TEXT,
    "date" DATETIME,
    "plaintiffs" TEXT,
    "defendants" TEXT,
    "status" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

CREATE TABLE "CivilTransmittalRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caseNumber" TEXT,
    "transmittedRaffledToBranch" TEXT,
    "dateReceived" DATETIME,
    "petitioners" TEXT,
    "defendants" TEXT,
    "issuedTransmittedByBranch" TEXT,
    "toBeRaffledOn" DATETIME,
    "natureOfTransmittal" TEXT,
    "orderResolutionDated" DATETIME,
    "attorney1" TEXT,
    "officeAddress1" TEXT,
    "attorney2" TEXT,
    "officeAddress2" TEXT,
    "attorney3" TEXT,
    "officeAddress3" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

CREATE TABLE "CriminalAppealedCase" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME,
    "referenceToBranch" TEXT,
    "mtcCaseNo" TEXT,
    "raffleDate" DATETIME,
    "fromMtcRtcJudge" TEXT,
    "orderDate" DATETIME,
    "branch" TEXT,
    "caseNo" TEXT,
    "dateFiled" DATETIME,
    "accused" TEXT,
    "charge" TEXT,
    "ao" TEXT,
    "appealedId" TEXT,
    "name1" TEXT,
    "address1" TEXT,
    "name2" TEXT,
    "address2" TEXT,
    "name3" TEXT,
    "address3" TEXT,
    "name4" TEXT,
    "address4" TEXT,
    "name5" TEXT,
    "address5" TEXT,
    "name6" TEXT,
    "address6" TEXT,
    "name7" TEXT,
    "address7" TEXT,
    "name8" TEXT,
    "address8" TEXT,
    "name9" TEXT,
    "address9" TEXT,
    "name10" TEXT,
    "address10" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME
);

CREATE INDEX "CivilCourtOfFirstInstanceTransmittal_date_idx" ON "CivilCourtOfFirstInstanceTransmittal"("date");
CREATE UNIQUE INDEX "CivilCourtOfFirstInstanceTransmittal_updatedAt_id_key" ON "CivilCourtOfFirstInstanceTransmittal"("updatedAt", "id");

CREATE INDEX "CivilTransmittalRecord_dateReceived_idx" ON "CivilTransmittalRecord"("dateReceived");
CREATE INDEX "CivilTransmittalRecord_toBeRaffledOn_idx" ON "CivilTransmittalRecord"("toBeRaffledOn");
CREATE UNIQUE INDEX "CivilTransmittalRecord_updatedAt_id_key" ON "CivilTransmittalRecord"("updatedAt", "id");

CREATE INDEX "CriminalAppealedCase_date_idx" ON "CriminalAppealedCase"("date");
CREATE INDEX "CriminalAppealedCase_raffleDate_idx" ON "CriminalAppealedCase"("raffleDate");
CREATE INDEX "CriminalAppealedCase_dateFiled_idx" ON "CriminalAppealedCase"("dateFiled");
CREATE UNIQUE INDEX "CriminalAppealedCase_updatedAt_id_key" ON "CriminalAppealedCase"("updatedAt", "id");
