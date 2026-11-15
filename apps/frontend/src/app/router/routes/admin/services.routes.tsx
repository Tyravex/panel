import type { RouteObject } from 'react-router-dom';
import { adminRoute } from '../../routeFactory';
import { AdminServicesPage } from '@/pages/admin/services/AdminServicesPage';
import { AdminServiceCreatePage } from '@/pages/admin/services/AdminServiceCreatePage';
import { AdminServiceDetailsPage } from '@/pages/admin/services/AdminServiceDetailsPage';
import { AdminServiceEditPage } from '@/pages/admin/services/AdminServiceEditPage';
import { AdminServiceOwnerPage } from '@/pages/admin/services/AdminServiceOwnerPage';
import { AdminServiceInstallationPage } from '@/pages/admin/services/AdminServiceInstallationPage';
import { AdminServiceEnvironmentPage } from '@/pages/admin/services/AdminServiceEnvironmentPage';

export const servicesRoutes: RouteObject[] = [
  adminRoute('/admin/services', "service:read:any", <AdminServicesPage />),
  adminRoute('/admin/services/new', ["service:read:any", "service:create"], <AdminServiceCreatePage />),
  adminRoute('/admin/services/:id', "service:read:any", <AdminServiceDetailsPage />),
  adminRoute('/admin/services/:id/edit', ["service:read:any", "service:manage:any"], <AdminServiceEditPage />),
  adminRoute('/admin/services/:id/owner', ["service:read:any", "service:transfer:any", "user:read"], <AdminServiceOwnerPage />),
  adminRoute('/admin/services/:id/installation', "service:read:any", <AdminServiceInstallationPage />),
  adminRoute('/admin/services/:id/environment', ["service:read:any", "service:manage:any"], <AdminServiceEnvironmentPage />),
];
