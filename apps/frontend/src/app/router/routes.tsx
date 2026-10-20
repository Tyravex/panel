import { useTranslation } from "react-i18next";
import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";
import { AdminPermissionRoute } from "./AdminPermissionRoute";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ServerDetailsPage } from "@/pages/dashboard/ServerDetailsPage";
import { AdminRolesPage } from "@/pages/admin/AdminRolesPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminSectionPage } from "@/pages/admin/AdminSectionPage";
import { AdminAuditPage } from "@/pages/admin/AdminAuditPage";
import { AdminSettingsPage } from "@/pages/admin/AdminSettingsPage";
import { AdminNodesPage } from "@/pages/admin/AdminNodesPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { SettingsPage } from "@/pages/settings";

export const AppRoutes = () => {
  const { t } = useTranslation();

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

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
        <Route
          path="/servers/:id"
          element={<ServerDetailsPage />}
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminSectionPage
                title={t("section.administrationOverview")}
                description={t("section.administrationDescription")}
              />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="user:read">
                <AdminDashboardPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="user:manage">
                <AdminSettingsPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/roles"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="role:manage">
                <AdminRolesPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/audit"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="role:manage">
                <AdminAuditPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/nodes"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="node:manage">
                <AdminNodesPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
};
