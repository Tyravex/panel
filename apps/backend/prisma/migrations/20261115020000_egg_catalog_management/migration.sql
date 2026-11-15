-- Additive catalog metadata. Existing Egg versions and service assignments remain intact.
ALTER TABLE "EggRepository"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN "lastSyncAt" TIMESTAMP(3),
ADD COLUMN "lastSyncError" TEXT,
ADD COLUMN "syncClaimUntil" TIMESTAMP(3),
ADD COLUMN "latestVersions" JSONB;

CREATE TABLE "EggTag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "ownerId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EggTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EggTag_scopeKey_slug_key" ON "EggTag"("scopeKey", "slug");
CREATE INDEX "EggTag_ownerId_idx" ON "EggTag"("ownerId");
ALTER TABLE "EggTag" ADD CONSTRAINT "EggTag_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "EggTagAssignment" (
  "eggId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "EggTagAssignment_pkey" PRIMARY KEY ("eggId", "tagId")
);
CREATE INDEX "EggTagAssignment_tagId_idx" ON "EggTagAssignment"("tagId");
ALTER TABLE "EggTagAssignment" ADD CONSTRAINT "EggTagAssignment_eggId_fkey" FOREIGN KEY ("eggId") REFERENCES "Egg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EggTagAssignment" ADD CONSTRAINT "EggTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "EggTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
