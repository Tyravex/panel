-- The default role is assigned by the RBAC v2 initializer.
-- This migration does not create or modify user accounts or role assignments.

CREATE TABLE "RbacSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "defaultRoleId" TEXT NOT NULL,

    CONSTRAINT "RbacSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RbacSettings_singleton_check" CHECK ("id" = 1)
);

ALTER TABLE "RbacSettings"
    ADD CONSTRAINT "RbacSettings_defaultRoleId_fkey"
    FOREIGN KEY ("defaultRoleId")
    REFERENCES "Role"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
