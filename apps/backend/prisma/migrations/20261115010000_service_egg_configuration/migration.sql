-- Additive migration. No existing services or Egg versions are rewritten.
ALTER TABLE "Egg" ADD COLUMN "provenance" JSONB;

CREATE TABLE "ServiceEggConfiguration" (
    "serviceId" TEXT NOT NULL,
    "profileId" TEXT,
    "runtimeVersion" TEXT,
    "environmentEncrypted" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceEggConfiguration_pkey" PRIMARY KEY ("serviceId")
);

ALTER TABLE "ServiceEggConfiguration"
ADD CONSTRAINT "ServiceEggConfiguration_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
