import { Routes, Route } from "react-router-dom";

import { MainLayout } from "@/layouts/MainLayout";
import { AuthLayout } from "@/layouts/AuthLayout";

import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";

import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ServerDetailsPage } from "@/pages/dashboard/ServerDetailsPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";

import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ProfilePage } from "@/pages/profile";
import { SettingsPage } from "@/pages/settings";

export const AppRoutes = () => (
  <Routes>
    {/* Public authentication routes */}
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>

    {/* Authenticated application routes */}
    <Route
      element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/" element={<DashboardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/servers/:id" element={<ServerDetailsPage />} />

      {/* Administration routes */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />
    </Route>
  </Routes>
);
