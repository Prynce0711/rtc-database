/*
  Warnings:

  - You are about to drop the `AnnualTrialCourt` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InventoryDocument` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AnnualTrialCourt";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "InventoryDocument";
PRAGMA foreign_keys=on;
