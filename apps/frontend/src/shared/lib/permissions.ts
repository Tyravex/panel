import type { User } from "@/entities/User";

// Keep the administration entry point aligned with permission-gated admin routes.
const ADMIN_ACCESS_PERMISSIONS = [
  "service:read:any", "service:create", "service:manage:any", "service:transfer:any", "service:install:any",
  "egg:read", "egg:import", "egg:manage", "egg:approve", "egg-repository:manage", "egg-repository:sync",
  "node:manage",
  "region:manage",
  "location:manage",
  "node:read",
  "plugin:read",
  "user:read",
  "user:manage",
  "role:manage",
  "plugin:manage",
  "user:create",
  "role:read",
  "role:assign",
  "audit:read",
  "settings:read",
] as const;

export const hasAdminAccess = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return ADMIN_ACCESS_PERMISSIONS.some((permission) =>
    user.permissions.includes(permission),
  );
};
