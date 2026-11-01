-- CreateEnum
CREATE TYPE "PluginRepositoryStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "PluginRepository" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "status" "PluginRepositoryStatus" NOT NULL DEFAULT 'DISABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PluginRepository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PluginRepository_url_key" ON "PluginRepository"("url");

-- CreateIndex
CREATE INDEX "PluginRepository_status_idx" ON "PluginRepository"("status");
