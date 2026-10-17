import type { User } from "@/entities/User";

// Keep the administration entry point aligned with permission-gated admin routes.
const ADMIN_ACCESS_PERMISSIONS = [
  "node:manage",
  "user:read",
  "user:manage",
  "role:manage",
] as const;

export const hasAdminAccess = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return ADMIN_ACCESS_PERMISSIONS.some((permission) =>
    user.permissions.includes(permission),
  );
};
