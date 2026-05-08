-- Store the previous raffle date separately from the current raffle date.
ALTER TABLE "CriminalCase" ADD COLUMN "previousRaffleDate" DATETIME;
ALTER TABLE "CivilCase" ADD COLUMN "previousRaffleDate" DATETIME;

UPDATE "CriminalCase"
SET "previousRaffleDate" = "raffleDate"
WHERE "previousRaffleDate" IS NULL
  AND "raffleDate" IS NOT NULL;

UPDATE "CivilCase"
SET "previousRaffleDate" = "reRaffleDate"
WHERE "previousRaffleDate" IS NULL
  AND "reRaffleDate" IS NOT NULL;
