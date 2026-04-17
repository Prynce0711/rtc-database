/*
  Warnings:

  - You are about to drop the `activity_log` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "activity_log";
PRAGMA foreign_keys=on;
