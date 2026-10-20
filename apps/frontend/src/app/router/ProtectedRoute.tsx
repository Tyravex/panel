import { useEffect, type JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/app/store/auth.store';
import { meApi } from '@/features/auth/api/auth.api';
import { useUser } from '@/shared/store/user';

interface ProtectedRouteProps {
  children: JSX.Element;
}

// Share the pending session check across StrictMode effect remounts.
let pendingSessionCheck: ReturnType<typeof meApi> | null = null;

const getSessionCheck = () => {
  if (!pendingSessionCheck) {
    const request = meApi();
    pendingSessionCheck = request;

    void request.finally(() => {
      if (pendingSessionCheck === request) {
        pendingSessionCheck = null;
      }
    }).catch(() => {
      // The component handles the original request rejection.
    });
  }

  return pendingSessionCheck;
};

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { t } = useTranslation();

  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    const initialState = useAuthStore.getState();

    if (!initialState.isLoading) {
      return;
    }

    let cancelled = false;
    const sessionVersion = initialState.sessionVersion;

    const isCurrentSession = () => {
      const state = useAuthStore.getState();

      return (
        !cancelled &&
        state.sessionVersion === sessionVersion &&
        state.isLoading
      );
    };

    getSessionCheck()
      .then(({ data }) => {
        if (!isCurrentSession()) return;

        useAuthStore.getState().setUser(data);
        useUser.getState().setUser(data);
      })
      .catch(() => {
        if (!isCurrentSession()) return;

        useAuthStore.getState().setUser(null);
        useUser.getState().setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
