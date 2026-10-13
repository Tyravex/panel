import { useEffect, JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/app/store/auth.store";
import { meApi } from "@/features/auth/api/auth.api";

interface ProtectedRouteProps {
  children: JSX.Element;
}

// Protects routes that require authentication
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, setUser, isLoading } = useAuthStore();

  useEffect(() => {
    if (!user) {
      meApi()
        .then(res => setUser(res.data))
        .catch(() => setUser(null));
    }
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};