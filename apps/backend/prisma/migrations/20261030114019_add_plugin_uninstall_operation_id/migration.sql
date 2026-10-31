/*
  Warnings:

  - A unique constraint covering the columns `[uninstallOperationId]` on the table `Plugin` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Plugin" ADD COLUMN     "uninstallOperationId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Plugin_uninstallOperationId_key" ON "Plugin"("uninstallOperationId");
