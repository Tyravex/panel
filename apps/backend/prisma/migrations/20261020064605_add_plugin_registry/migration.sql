-- CreateEnum
CREATE TYPE "PluginType" AS ENUM ('LANGUAGE', 'THEME', 'INTEGRATION', 'BILLING', 'NOTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('INSTALLED', 'DISABLED', 'FAILED');

-- CreateTable
CREATE TABLE "Plugin" (
    "id" TEXT NOT NULL,
    "type" "PluginType" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "PluginStatus" NOT NULL DEFAULT 'DISABLED',
    "storagePath" TEXT NOT NULL,
    "sourceRepository" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plugin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plugin_type_status_idx" ON "Plugin"("type", "status");

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
