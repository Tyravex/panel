import { useTranslation } from "react-i18next";
import { Routes, Route } from "react-router-dom";
import { MainLayout } from "@/layouts/MainLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";
import { AdminPermissionRoute } from "./AdminPermissionRoute";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ServiceDetailsPage } from "@/pages/dashboard/ServiceDetailsPage";
import { AdminRolesPage } from "@/pages/admin/roles/AdminRolesPage";
import { AdminUsersPage } from "@/pages/admin/users/AdminUsersPage";
import { AdminUserCreatePage } from "@/pages/admin/users/AdminUserCreatePage";
import { AdminUserDetailsPage } from "@/pages/admin/users/AdminUserDetailsPage";
import { AdminUserEditPage } from "@/pages/admin/users/AdminUserEditPage";
import { AdminUserRolesPage } from "@/pages/admin/users/AdminUserRolesPage";
import { AdminSectionPage } from "@/pages/admin/AdminSectionPage";
import { AdminAuditPage } from "@/pages/admin/audit/AdminAuditPage";
import { AdminPluginsPage } from "@/pages/admin/plugins/AdminPluginsPage";
import { AdminMarketplacePage } from '@/pages/admin/marketplace/AdminMarketplacePage';
import { AdminPluginDetailsPage } from "@/pages/admin/plugins/AdminPluginDetailsPage";
import { AdminSettingsPage } from "@/pages/admin/settings/AdminSettingsPage";
import { AdminNodesPage } from "@/pages/admin/nodes/AdminNodesPage";
import { AdminNodeCreatePage } from "@/pages/admin/nodes/AdminNodeCreatePage";
import { AdminNodeDetailsPage } from "@/pages/admin/nodes/AdminNodeDetailsPage";
import { AdminRegionsPage } from "@/pages/admin/regions/AdminRegionsPage";
import { AdminLocationsPage } from "@/pages/admin/locations/AdminLocationsPage";
import { AdminServicesPage } from "@/pages/admin/services/AdminServicesPage";
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
        <Route path="/services/:id" element={<ServiceDetailsPage />} />

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
          path="/admin/users/new"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="user:manage">
                <AdminUserCreatePage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/users/:id/edit"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="user:manage">
                <AdminUserEditPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users/:id/roles"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="role:manage">
                <AdminUserRolesPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/users/:id"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="user:read">
                <AdminUserDetailsPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="user:read">
                <AdminUsersPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/plugins"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="plugin:manage">
                <AdminPluginsPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/plugins/marketplace"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="plugin:manage">
                <AdminMarketplacePage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/plugins/:id"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="plugin:manage">
                <AdminPluginDetailsPage />
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
          path="/admin/regions"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="node:manage">
                <AdminRegionsPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/locations"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="node:manage">
                <AdminLocationsPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route path="/admin/nodes"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="node:manage">
                <AdminNodesPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />

        <Route
          path="/admin/nodes/new"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="node:manage">
                <AdminNodeCreatePage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/nodes/:id"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="node:manage">
                <AdminNodeDetailsPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/services"
          element={
            <AdminRoute>
              <AdminPermissionRoute permission="service:manage:any">
                <AdminServicesPage />
              </AdminPermissionRoute>
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
};
