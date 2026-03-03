-- CreateTable
CREATE TABLE "monthlyStatistics" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "category" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "criminal" INTEGER,
    "civil" INTEGER,
    "total" INTEGER
);
