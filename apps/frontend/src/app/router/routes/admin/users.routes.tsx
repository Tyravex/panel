import type { RouteObject } from 'react-router-dom';
import { adminRoute } from '../../routeFactory';
import { AdminUsersPage } from '@/pages/admin/users/AdminUsersPage';
import { AdminUserCreatePage } from '@/pages/admin/users/AdminUserCreatePage';
import { AdminUserDetailsPage } from '@/pages/admin/users/AdminUserDetailsPage';
import { AdminUserEditPage } from '@/pages/admin/users/AdminUserEditPage';
import { AdminUserRolesPage } from '@/pages/admin/users/AdminUserRolesPage';

export const usersRoutes: RouteObject[] = [
  adminRoute('/admin/users', "user:read", <AdminUsersPage />),
  adminRoute('/admin/users/new', "user:create", <AdminUserCreatePage />),
  adminRoute('/admin/users/:id', "user:read", <AdminUserDetailsPage />),
  adminRoute('/admin/users/:id/edit', "user:manage", <AdminUserEditPage />),
  adminRoute('/admin/users/:id/roles', ["user:read", "role:read"], <AdminUserRolesPage />),
];
