import { useCallback, useEffect, useState } from 'react';
import type { EggRepository } from '@shared/types';
import { eggsApi } from '../api/eggsApi';
import { getApiErrorMessage as roleErrorMessage } from '@/shared/lib/getApiErrorMessage';

export const useEggRepository = (id?: string) => {
  const [repository, setRepository] = useState<EggRepository | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => { const controller = new AbortController(); setLoading(true); setError('');
    void eggsApi.repositories(controller.signal).then((rows) => { if (controller.signal.aborted) return;
      const found = rows.find((row) => row.id === id); if (!found) throw new Error('Repository not found'); setRepository(found);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(roleErrorMessage(reason)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  return { repository, error, loading, refresh };
};
