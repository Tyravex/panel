import { useEffect } from 'react';
import { useAuthStore } from '@/app/store/auth.store';
import { useUser } from '@/shared/store/user';
import { meApi } from '@/features/auth/api/auth.api';

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

export const useSessionBootstrap = () => {
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
};
