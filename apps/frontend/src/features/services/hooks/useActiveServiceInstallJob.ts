
import { useQuery } from '@tanstack/react-query';

import { getActiveServiceInstallJob } from '@/features/services/api/services.api';
import { useUser } from '@/shared/store/user';

export const useActiveServiceInstallJob = (serviceId?: string) => {
    const userId = useUser((state) => state.user?.id);

    return useQuery({
        queryKey: ['active-service-install-job', userId, serviceId],
        queryFn: () => getActiveServiceInstallJob(serviceId!),
        enabled: userId !== undefined && Boolean(serviceId?.trim()),
        staleTime: 5_000,
        refetchInterval: 10_000,
        retry: (failureCount, error) => {
            const status = (error as { response?: { status?: number } })
                ?.response?.status;

            return status !== 401 &&
                status !== 403 &&
                status !== 404 &&
                failureCount < 1;
        },
    });
};
