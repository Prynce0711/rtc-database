-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_JudgementMunicipal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branchNo" TEXT,
    "dateRecorded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "civilV" INTEGER NOT NULL,
    "civilInc" INTEGER NOT NULL,
    "criminalV" INTEGER NOT NULL,
    "criminalInc" INTEGER NOT NULL,
    "totalHeard" INTEGER NOT NULL DEFAULT 0,
    "disposedCivil" INTEGER NOT NULL DEFAULT 0,
    "disposedCrim" INTEGER NOT NULL DEFAULT 0,
    "totalDisposed" INTEGER NOT NULL DEFAULT 0,
    "pdlM" INTEGER NOT NULL DEFAULT 0,
    "pdlF" INTEGER NOT NULL DEFAULT 0,
    "pdlTotal" INTEGER NOT NULL DEFAULT 0,
    "pdlV" INTEGER NOT NULL DEFAULT 0,
    "pdlI" INTEGER NOT NULL DEFAULT 0,
    "pdlBail" INTEGER NOT NULL DEFAULT 0,
    "pdlRecognizance" INTEGER NOT NULL DEFAULT 0,
    "pdlMinRor" INTEGER NOT NULL DEFAULT 0,
    "pdlMaxSentence" INTEGER NOT NULL DEFAULT 0,
    "pdlDismissal" INTEGER NOT NULL DEFAULT 0,
    "pdlAcquittal" INTEGER NOT NULL DEFAULT 0,
    "pdlMinSentence" INTEGER NOT NULL DEFAULT 0,
    "pdlOthers" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_JudgementMunicipal" ("branchNo", "civilInc", "civilV", "criminalInc", "criminalV", "disposedCivil", "disposedCrim", "id", "pdlAcquittal", "pdlBail", "pdlDismissal", "pdlF", "pdlI", "pdlM", "pdlMaxSentence", "pdlMinRor", "pdlMinSentence", "pdlOthers", "pdlRecognizance", "pdlTotal", "pdlV", "total", "totalDisposed", "totalHeard") SELECT "branchNo", "civilInc", "civilV", "criminalInc", "criminalV", "disposedCivil", "disposedCrim", "id", "pdlAcquittal", "pdlBail", "pdlDismissal", "pdlF", "pdlI", "pdlM", "pdlMaxSentence", "pdlMinRor", "pdlMinSentence", "pdlOthers", "pdlRecognizance", "pdlTotal", "pdlV", "total", "totalDisposed", "totalHeard" FROM "JudgementMunicipal";
DROP TABLE "JudgementMunicipal";
ALTER TABLE "new_JudgementMunicipal" RENAME TO "JudgementMunicipal";
CREATE TABLE "new_JudgementRegional" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branchNo" TEXT,
    "dateRecorded" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "civilV" INTEGER NOT NULL,
    "civilInc" INTEGER NOT NULL,
    "criminalV" INTEGER NOT NULL,
    "criminalInc" INTEGER NOT NULL,
    "totalHeard" INTEGER NOT NULL DEFAULT 0,
    "disposedCivil" INTEGER NOT NULL DEFAULT 0,
    "disposedCrim" INTEGER NOT NULL DEFAULT 0,
    "summaryProc" INTEGER NOT NULL DEFAULT 0,
    "casesDisposed" INTEGER NOT NULL DEFAULT 0,
    "pdlM" INTEGER NOT NULL DEFAULT 0,
    "pdlF" INTEGER NOT NULL DEFAULT 0,
    "pdlCICL" INTEGER NOT NULL DEFAULT 0,
    "pdlTotal" INTEGER NOT NULL DEFAULT 0,
    "pdlV" INTEGER NOT NULL DEFAULT 0,
    "pdlInc" INTEGER NOT NULL DEFAULT 0,
    "pdlBail" INTEGER NOT NULL DEFAULT 0,
    "pdlRecognizance" INTEGER NOT NULL DEFAULT 0,
    "pdlMinRor" INTEGER NOT NULL DEFAULT 0,
    "pdlMaxSentence" INTEGER NOT NULL DEFAULT 0,
    "pdlDismissal" INTEGER NOT NULL DEFAULT 0,
    "pdlAcquittal" INTEGER NOT NULL DEFAULT 0,
    "pdlMinSentence" INTEGER NOT NULL DEFAULT 0,
    "pdlProbation" INTEGER NOT NULL DEFAULT 0,
    "ciclM" INTEGER NOT NULL DEFAULT 0,
    "ciclF" INTEGER NOT NULL DEFAULT 0,
    "ciclV" INTEGER NOT NULL DEFAULT 0,
    "ciclInc" INTEGER NOT NULL DEFAULT 0,
    "fine" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_JudgementRegional" ("branchNo", "casesDisposed", "ciclF", "ciclInc", "ciclM", "ciclV", "civilInc", "civilV", "criminalInc", "criminalV", "disposedCivil", "disposedCrim", "fine", "id", "pdlAcquittal", "pdlBail", "pdlCICL", "pdlDismissal", "pdlF", "pdlInc", "pdlM", "pdlMaxSentence", "pdlMinRor", "pdlMinSentence", "pdlProbation", "pdlRecognizance", "pdlTotal", "pdlV", "summaryProc", "total", "totalHeard") SELECT "branchNo", "casesDisposed", "ciclF", "ciclInc", "ciclM", "ciclV", "civilInc", "civilV", "criminalInc", "criminalV", "disposedCivil", "disposedCrim", "fine", "id", "pdlAcquittal", "pdlBail", "pdlCICL", "pdlDismissal", "pdlF", "pdlInc", "pdlM", "pdlMaxSentence", "pdlMinRor", "pdlMinSentence", "pdlProbation", "pdlRecognizance", "pdlTotal", "pdlV", "summaryProc", "total", "totalHeard" FROM "JudgementRegional";
DROP TABLE "JudgementRegional";
ALTER TABLE "new_JudgementRegional" RENAME TO "JudgementRegional";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
