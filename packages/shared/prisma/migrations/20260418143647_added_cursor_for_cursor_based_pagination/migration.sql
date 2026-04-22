/*
  Warnings:

  - You are about to drop the `Sherriff` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `ChatMessage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `CivilCase` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `CriminalCase` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `Log` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `Notarial` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `Petition` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `SheriffCase` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[updatedAt,id]` on the table `SpecialProceeding` will be added. If there are existing duplicate values, this will fail.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Sherriff";
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_updatedAt_id_key" ON "ChatMessage"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CivilCase_updatedAt_id_key" ON "CivilCase"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CriminalCase_updatedAt_id_key" ON "CriminalCase"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_updatedAt_id_key" ON "Employee"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Log_updatedAt_id_key" ON "Log"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Notarial_updatedAt_id_key" ON "Notarial"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Petition_updatedAt_id_key" ON "Petition"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SheriffCase_updatedAt_id_key" ON "SheriffCase"("updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialProceeding_updatedAt_id_key" ON "SpecialProceeding"("updatedAt", "id");
