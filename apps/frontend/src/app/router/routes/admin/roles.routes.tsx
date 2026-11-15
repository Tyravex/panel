import type { RouteObject } from 'react-router-dom';
import { adminRoute } from '../../routeFactory';
import { AdminRolesPage } from '@/pages/admin/roles/AdminRolesPage';
import { AdminRoleCreatePage } from '@/pages/admin/roles/AdminRoleCreatePage';
import { AdminRoleEditPage } from '@/pages/admin/roles/AdminRoleEditPage';
import { AdminRoleComparePage } from '@/pages/admin/roles/AdminRoleComparePage';

export const rolesRoutes: RouteObject[] = [
  adminRoute('/admin/roles', "role:read", <AdminRolesPage />),
  adminRoute('/admin/roles/new', ["role:read", "role:manage"], <AdminRoleCreatePage />),
  adminRoute('/admin/roles/:id/edit', ["role:read", "role:manage"], <AdminRoleEditPage />),
  adminRoute('/admin/roles/compare', "role:read", <AdminRoleComparePage />),
];
