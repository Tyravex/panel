-- CreateEnum
CREATE TYPE "EggSourceType" AS ENUM ('OFFICIAL', 'COMMUNITY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EggApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Egg" ADD COLUMN     "approvalStatus" "EggApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "ownerId" INTEGER,
ADD COLUMN     "sourceType" "EggSourceType" NOT NULL DEFAULT 'COMMUNITY';

-- CreateIndex
CREATE INDEX "Egg_sourceType_approvalStatus_idx" ON "Egg"("sourceType", "approvalStatus");

-- CreateIndex
CREATE INDEX "Egg_ownerId_createdAt_idx" ON "Egg"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Egg" ADD CONSTRAINT "Egg_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the provenance of Eggs from official repositories.
-- Repository metadata does not independently establish trust.
UPDATE "Egg" AS egg
SET "sourceType" = 'OFFICIAL'
FROM "EggRepository" AS repository
WHERE egg."repositoryId" = repository."id"
  AND repository."isOfficial" = true;

-- Preserve the approval state of previously enabled Eggs.
-- This does not enable any additional Egg definitions.
UPDATE "Egg"
SET
    "approvalStatus" = 'APPROVED',
    "approvedAt" = CURRENT_TIMESTAMP
WHERE "isEnabled" = true;