import { useRoutes, type RouteObject } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AdminSectionPage } from '@/pages/admin/AdminSectionPage';
import { ProtectedRoute } from './guards/ProtectedRoute';
import { AdminRoute } from './guards/AdminRoute';
import { authRoutes } from './routes/auth.routes';
import { accountRoutes } from './routes/account.routes';
import { usersRoutes } from './routes/admin/users.routes';
import { rolesRoutes } from './routes/admin/roles.routes';
import { infrastructureRoutes } from './routes/admin/infrastructure.routes';
import { pluginsRoutes } from './routes/admin/plugins.routes';
import { systemRoutes } from './routes/admin/system.routes';
import { servicesRoutes } from './routes/admin/services.routes';
import { eggsRoutes } from './routes/admin/eggs.routes';

const AdminOverview = () => {
  const { t } = useTranslation();
  return <AdminRoute><AdminSectionPage title={t('section.administrationOverview')} description={t('section.administrationDescription')} /></AdminRoute>;
};

export const appRoutes: RouteObject[] = [
  { element: <AuthLayout />, children: authRoutes },
  {
    element: <ProtectedRoute><MainLayout /></ProtectedRoute>, children: [
      ...accountRoutes,
      { path: '/admin', element: <AdminOverview /> },
      ...usersRoutes, ...rolesRoutes, ...infrastructureRoutes, ...pluginsRoutes,
      ...systemRoutes, ...servicesRoutes, ...eggsRoutes,
    ]
  },
];

export const AppRoutes = () => useRoutes(appRoutes);
