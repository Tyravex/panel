
import { useNavigate } from 'react-router-dom';

import { api } from '@/shared/api/client';
import { useAuthStore } from '@/app/store/auth.store';
import { useUser } from '@/shared/store/user';

export const useLogout = () => {
  const navigate = useNavigate();

  const logout = async () => {
    // Invalidate pending authentication requests immediately.
    useAuthStore.getState().logout();
    useUser.getState().setUser(null);

    // Remove tokens from the legacy authentication flow.
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');

    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Server logout failed:', error);

      // Keep the user signed out locally, but report that the
      // server-side session might still be active.
      window.alert(
        'Nie udało się potwierdzić wylogowania na serwerze. ' +
        'Sesja może nadal być aktywna. Spróbuj ponownie później.',
      );
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return { logout };
};
