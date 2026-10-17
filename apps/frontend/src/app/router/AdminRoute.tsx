import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "@/app/store/auth.store";
import { hasAdminAccess } from "@/shared/lib/permissions";

interface AdminRouteProps {
  children: ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const user = useAuthStore((state) => state.user);

  if (!hasAdminAccess(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};