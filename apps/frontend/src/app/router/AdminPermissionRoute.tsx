import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/app/store/auth.store";

interface AdminPermissionRouteProps { permission: string; children: ReactNode }
export const AdminPermissionRoute = ({ permission, children }: AdminPermissionRouteProps) => {
  const user = useAuthStore((state) => state.user);
  // Route-level checks prevent direct URL access; the backend must enforce permissions too.
  if (!user?.permissions?.includes(permission)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};
