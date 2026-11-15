import type { RouteObject } from 'react-router-dom';
import { adminRoute } from '../../routeFactory';
import { AdminRegionsPage } from '@/pages/admin/regions/AdminRegionsPage';
import { AdminLocationsPage } from '@/pages/admin/locations/AdminLocationsPage';
import { AdminNodesPage } from '@/pages/admin/nodes/AdminNodesPage';
import { AdminNodeCreatePage } from '@/pages/admin/nodes/AdminNodeCreatePage';
import { AdminNodeDetailsPage } from '@/pages/admin/nodes/AdminNodeDetailsPage';

export const infrastructureRoutes: RouteObject[] = [
  adminRoute('/admin/regions', "region:manage", <AdminRegionsPage />),
  adminRoute('/admin/locations', "location:manage", <AdminLocationsPage />),
  adminRoute('/admin/nodes', "node:read", <AdminNodesPage />),
  adminRoute('/admin/nodes/new', ["node:manage", "region:manage", "location:manage"], <AdminNodeCreatePage />),
  adminRoute('/admin/nodes/:id', "node:read", <AdminNodeDetailsPage />),
];
