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
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ProfilePage } from "@/pages/profile";
import { SettingsPage } from "@/pages/settings";

export const AppRoutes = () => (
  <Routes>
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Route>
    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/servers/:id" element={<ServerDetailsPage />} />
      {/* Each admin route has its own permission check, including direct URL access. */}
      <Route element={<AdminRoute><></></AdminRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminSectionPage title="Administration overview" description="Manage your Tyravex infrastructure." /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminPermissionRoute permission="user:read"><AdminDashboardPage /></AdminPermissionRoute></AdminRoute>} />
      <Route path="/admin/roles" element={<AdminRoute><AdminPermissionRoute permission="role:manage"><AdminRolesPage /></AdminPermissionRoute></AdminRoute>} />
      <Route path="/admin/audit" element={<AdminRoute><AdminPermissionRoute permission="role:manage"><AdminAuditPage /></AdminPermissionRoute></AdminRoute>}/>
      <Route path="/admin/nodes" element={<AdminRoute><AdminPermissionRoute permission="node:manage"><AdminSectionPage title="Nodes" description="Node management will be connected to the existing backend in a later stage." planned /></AdminPermissionRoute></AdminRoute>} />
    </Route>
  </Routes>
);
