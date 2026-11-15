import { useCallback, useEffect, useState } from 'react';
import type { AdminEgg } from '@shared/types';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';
import { eggsApi } from '../api/eggsApi';

export const useAdminEgg = (id?: string) => {
  const [egg, setEgg] = useState<AdminEgg | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError(''); setEgg(null);
    if (!id) { setLoading(false); return; }
    void eggsApi.get(id, controller.signal).then((value) => { if (!controller.signal.aborted) setEgg(value); }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(roleErrorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  return { egg, error, loading, refresh };
};
