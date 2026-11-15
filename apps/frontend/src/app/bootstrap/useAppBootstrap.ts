import { useEffect, useState } from 'react';
import { useUser } from '@/shared/store/user';

export const useAppBootstrap = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void useUser.getState().syncActiveLanguage().catch((error: unknown) => {
      console.error('Failed to initialize language:', error);
    }).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  return ready;
};
