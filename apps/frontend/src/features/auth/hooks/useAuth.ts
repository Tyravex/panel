import { loginApi, meApi } from '../api/auth.api';
import { useAuthStore } from '@/app/store/auth.store';
import { useUser } from '@/shared/store/user';

interface LoginCredentials {
  usernameOrEmail: string;
  password: string;
}

export const useAuth = () => {
  const handleLogin = async (data: LoginCredentials) => {
    const sessionVersion = useAuthStore.getState().sessionVersion;

    // The backend sets the JWT in an HttpOnly cookie.
    await loginApi(data);

    // Fetch the authenticated user using that cookie.
    const response = await meApi();

    // Ignore responses belonging to an invalidated session.
    if (useAuthStore.getState().sessionVersion !== sessionVersion) {
      return false;
    }

    const user = response.data;

    useAuthStore.getState().setUser(user);
    useUser.getState().setUser(user);

    // Remove tokens left by the old localStorage-based login flow.
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    return true;
  };

  return { login: handleLogin };
};