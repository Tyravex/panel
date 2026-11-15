import { useCallback, useEffect, useState } from 'react';
import { adminServicesApi, type AdminService } from '../api/adminServicesApi';
import { getServiceErrorMessage } from '../lib/serviceForm';

export const useAdminService = (id?: string) => {
  const [service, setService] = useState<AdminService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setService(null); setError('');
    if (!id) { setLoading(false); return; }
    void adminServicesApi.get(id, controller.signal).then((data) => { if (!controller.signal.aborted) setService(data); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(getServiceErrorMessage(reason, 'Request failed')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  return { service, loading, error, refresh };
};
