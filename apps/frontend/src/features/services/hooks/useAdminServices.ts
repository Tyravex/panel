import { useCallback, useEffect, useState } from 'react';
import { adminServicesApi, type AdminService, type CreateAdminService } from '@/features/services/api/adminServicesApi';
import { nodesApi, type NodeRecord } from '@/features/nodes/api/nodesApi';
import { getServiceErrorMessage } from '@/features/services/lib/serviceForm';

export const useAdminServices = (fallbackError: string) => {
    const [services, setServices] = useState<AdminService[]>([]);
    const [nodes, setNodes] = useState<NodeRecord[]>([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [nodesLoading, setNodesLoading] = useState(true);
    const [servicesError, setServicesError] = useState('');
    const [nodesError, setNodesError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busy, setBusy] = useState(false);
    const [refreshIndex, setRefreshIndex] = useState(0);
    const refresh = useCallback(() => setRefreshIndex((index) => index + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        setServicesLoading(true);
        setNodesLoading(true);
        void adminServicesApi.list(controller.signal)
            .then((items) => { if (!controller.signal.aborted) { setServices(items); setServicesError(''); } })
            .catch((error: unknown) => { if (!controller.signal.aborted) setServicesError(getServiceErrorMessage(error, fallbackError)); })
            .finally(() => { if (!controller.signal.aborted) setServicesLoading(false); });
        void nodesApi.list(controller.signal)
            .then((items) => { if (!controller.signal.aborted) { setNodes(items); setNodesError(''); } })
            .catch((error: unknown) => { if (!controller.signal.aborted) setNodesError(getServiceErrorMessage(error, fallbackError)); })
            .finally(() => { if (!controller.signal.aborted) setNodesLoading(false); });
        return () => controller.abort();
    }, [refreshIndex, fallbackError]);

    const perform = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
        if (busy) return false;
        setBusy(true);
        setActionError('');
        try { await action(); refresh(); return true; }
        catch (error) { setActionError(getServiceErrorMessage(error, fallbackError)); return false; }
        finally { setBusy(false); }
    }, [busy, fallbackError, refresh]);

    const create = (payload: CreateAdminService) => perform(() => adminServicesApi.create(payload));
    const setOwner = (id: string, userId: number | null) => perform(() => adminServicesApi.setOwner(id, userId));

    return {
        services, nodes, servicesLoading, nodesLoading, servicesError, nodesError,
        actionError, setActionError, busy, refresh, create, setOwner
    };
};
