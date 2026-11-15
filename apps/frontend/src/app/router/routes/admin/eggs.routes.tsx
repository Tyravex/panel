import type { RouteObject } from 'react-router-dom';
import { adminRoute } from '../../routeFactory';
import { AdminEggsPage } from '@/pages/admin/eggs/AdminEggsPage';
import { AdminEggImportPage } from '@/pages/admin/eggs/AdminEggImportPage';
import { AdminEggDetailsPage } from '@/pages/admin/eggs/AdminEggDetailsPage';
import { AdminEggEditPage } from '@/pages/admin/eggs/AdminEggEditPage';
import { AdminEggRepositoriesPage } from '@/pages/admin/eggs/AdminEggRepositoriesPage';
import { AdminEggRepositoryCreatePage } from '@/pages/admin/eggs/AdminEggRepositoryCreatePage';
import { AdminEggRepositoryDetailsPage } from '@/pages/admin/eggs/AdminEggRepositoryDetailsPage';
import { AdminEggRepositoryEditPage } from '@/pages/admin/eggs/AdminEggRepositoryEditPage';
import { AdminEggTagsPage } from '@/pages/admin/eggs/AdminEggTagsPage';

export const eggsRoutes: RouteObject[] = [
  adminRoute('/admin/eggs', "egg:read", <AdminEggsPage />),
  adminRoute('/admin/eggs/import', ["egg:read", "egg:import"], <AdminEggImportPage />),
  adminRoute('/admin/eggs/tags', "egg:read", <AdminEggTagsPage />),
  adminRoute('/admin/eggs/:id', "egg:read", <AdminEggDetailsPage />),
  adminRoute('/admin/eggs/:id/edit', ["egg:read", "egg:manage"], <AdminEggEditPage />),
  adminRoute('/admin/eggs/repositories', "egg:read", <AdminEggRepositoriesPage />),
  adminRoute('/admin/eggs/repositories/new', ["egg:read", "egg-repository:manage"], <AdminEggRepositoryCreatePage />),
  adminRoute('/admin/eggs/repositories/:id', "egg:read", <AdminEggRepositoryDetailsPage />),
  adminRoute('/admin/eggs/repositories/:id/edit', ["egg:read", "egg-repository:manage"], <AdminEggRepositoryEditPage />),
];
