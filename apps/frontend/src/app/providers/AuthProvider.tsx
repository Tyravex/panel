import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/shared/store/user';
import { api } from '@/shared/api/client';
import { Loader } from '@/shared/components/Loader';
import i18n from "@/shared/i18n"

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [loading, setLoading] = useState(true);

  const setUser = useUser((s) => s.setUser);
  const setLanguage = useUser((s) => s.setLanguage);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // console.log('[AuthProvider] Fetching user...');
        const { data } = await api.get('/auth/me');
        // console.log('[AuthProvider] User data:', data);
         const user = {
           ...data,
           language: data.language || 'en',
        };

        setUser(user);
        setLanguage(data.language);
        i18n.changeLanguage(data.language);

      } catch (err) {
        console.error('[AuthProvider] Error fetching user:', err);
        setUser(null!);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate, setUser, setLanguage]);

  if (loading) return <Loader />;

  return <>{children}</>;
};