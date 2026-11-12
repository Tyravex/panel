ALTER TABLE "Node"
    ADD COLUMN "manualAllocationEnabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "automaticAllocationEnabled" BOOLEAN NOT NULL DEFAULT false;
