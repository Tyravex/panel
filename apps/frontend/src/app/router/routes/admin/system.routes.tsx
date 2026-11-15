import type { RouteObject } from 'react-router-dom';
import { adminRoute } from '../../routeFactory';
import { AdminSettingsPage } from '@/pages/admin/settings/AdminSettingsPage';
import { AdminAuditPage } from '@/pages/admin/audit/AdminAuditPage';

export const systemRoutes: RouteObject[] = [
  adminRoute('/admin/settings', "settings:read", <AdminSettingsPage />),
  adminRoute('/admin/audit', "audit:read", <AdminAuditPage />),
];
