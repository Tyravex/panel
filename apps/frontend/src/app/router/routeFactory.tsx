import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AdminRoute } from './guards/AdminRoute';
import { AdminPermissionRoute } from './guards/AdminPermissionRoute';

export const adminRoute = (path: string, permission: string | readonly string[], page: ReactNode): RouteObject => ({
  path, element: <AdminRoute><AdminPermissionRoute permission={permission}>{page}</AdminPermissionRoute></AdminRoute>,
});
