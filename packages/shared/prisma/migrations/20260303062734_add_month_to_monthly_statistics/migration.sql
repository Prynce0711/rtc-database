/*
  Warnings:

  - Added the required column `month` to the `monthlyStatistics` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_monthlyStatistics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "criminal" INTEGER NOT NULL DEFAULT 0,
    "civil" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_monthlyStatistics" ("branch", "category", "civil", "criminal", "id", "total") SELECT "branch", "category", coalesce("civil", 0) AS "civil", coalesce("criminal", 0) AS "criminal", "id", coalesce("total", 0) AS "total" FROM "monthlyStatistics";
DROP TABLE "monthlyStatistics";
ALTER TABLE "new_monthlyStatistics" RENAME TO "monthlyStatistics";
CREATE UNIQUE INDEX "monthlyStatistics_month_category_branch_key" ON "monthlyStatistics"("month", "category", "branch");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
