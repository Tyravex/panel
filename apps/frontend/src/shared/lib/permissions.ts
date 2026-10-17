
import type { User } from "@/entities/User";

// Permissions granting access to the administration overview.
const ADMIN_ACCESS_PERMISSIONS = [
  "node:manage",
  "user:manage",
  "role:manage",
] as const;

export const hasAdminAccess = (
  user: User | null | undefined,
): boolean => {
  if (!user) return false;

  return ADMIN_ACCESS_PERMISSIONS.some((permission) =>
    user.permissions.includes(permission),
  );
};
