import type { RouteObject } from 'react-router-dom';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { SettingsPage } from '@/pages/settings';
import { ServiceDetailsPage } from '@/pages/dashboard/ServiceDetailsPage';
import { EggTagsPage } from '@/pages/settings/EggTagsPage';

export const accountRoutes: RouteObject[] = [
  { path: '/', element: <DashboardPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/settings/egg-tags', element: <EggTagsPage /> },
  { path: '/services/:id', element: <ServiceDetailsPage /> },
];
