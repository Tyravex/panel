import type { RouteObject } from 'react-router-dom';
import { adminRoute } from '../../routeFactory';
import { AdminPluginsPage } from '@/pages/admin/plugins/AdminPluginsPage';
import { AdminPluginDetailsPage } from '@/pages/admin/plugins/AdminPluginDetailsPage';
import { AdminMarketplacePage } from '@/pages/admin/marketplace/AdminMarketplacePage';

export const pluginsRoutes: RouteObject[] = [
  adminRoute('/admin/plugins', "plugin:read", <AdminPluginsPage />),
  adminRoute('/admin/plugins/:id', "plugin:read", <AdminPluginDetailsPage />),
  adminRoute('/admin/plugins/marketplace', "plugin:read", <AdminMarketplacePage />),
];
