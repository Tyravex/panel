-- CreateEnum
CREATE TYPE "EggRepositoryStatus" AS ENUM ('ENABLED', 'DISABLED');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "eggId" TEXT;

-- CreateTable
CREATE TABLE "EggRepository" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "status" "EggRepositoryStatus" NOT NULL DEFAULT 'DISABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EggRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Egg" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Egg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EggRepository_url_key" ON "EggRepository"("url");

-- CreateIndex
CREATE INDEX "EggRepository_status_idx" ON "EggRepository"("status");

-- CreateIndex
CREATE INDEX "Egg_repositoryId_isEnabled_idx" ON "Egg"("repositoryId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Egg_repositoryId_key_version_key" ON "Egg"("repositoryId", "key", "version");

-- CreateIndex
CREATE INDEX "Service_eggId_idx" ON "Service"("eggId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_eggId_fkey" FOREIGN KEY ("eggId") REFERENCES "Egg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Egg" ADD CONSTRAINT "Egg_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "EggRepository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
