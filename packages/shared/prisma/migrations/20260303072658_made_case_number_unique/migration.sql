/*
  Warnings:

  - A unique constraint covering the columns `[caseNumber]` on the table `Case` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
