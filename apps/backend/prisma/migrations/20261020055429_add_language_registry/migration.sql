-- CreateTable
CREATE TABLE "Language" (
    "code" VARCHAR(35) NOT NULL,
    "name" TEXT NOT NULL,
    "pluginId" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "Language_pluginId_key" ON "Language"("pluginId");

-- CreateIndex
CREATE INDEX "Language_isEnabled_idx" ON "Language"("isEnabled");
