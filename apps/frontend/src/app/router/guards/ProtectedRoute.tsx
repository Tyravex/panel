import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/app/store/auth.store';
import { useSessionBootstrap } from '@/features/auth/hooks/useSessionBootstrap';


interface ProtectedRouteProps {
  children: JSX.Element;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { t } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  useSessionBootstrap();

  if (isLoading) {
    return (
      <div role="status" aria-live="polite">
        {t('auth.session.loading', { defaultValue: 'Loading...' })}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
