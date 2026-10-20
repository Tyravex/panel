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

    let serverLogoutFailed = false;

    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Server logout failed:', error);

      // The local session is already cleared, but the server-side
      // session may still be active.
      serverLogoutFailed = true;
    } finally {
      navigate('/login', {
        replace: true,
        state: serverLogoutFailed
          ? { logoutWarning: true }
          : null,
      });
    }
  };

  return { logout };
};