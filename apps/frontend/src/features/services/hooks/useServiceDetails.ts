import { useQuery } from "@tanstack/react-query";

import { getUserService } from "@/features/services/api/services.api";
import { useUser } from "@/shared/store/user";

export const useServiceDetails = (serviceId?: string) => {
    const user = useUser((state) => state.user);
    const userId = user?.id;
    const enabled = userId !== undefined && Boolean(serviceId?.trim());

    const serviceQuery = useQuery({
        queryKey: ["user-service", userId, serviceId],
        queryFn: () => getUserService(serviceId!),
        enabled,
        staleTime: 30_000,
        retry: (failureCount, error) => {
            const status = (error as { response?: { status?: number } })?.response?.status;
            return status !== 404 && status !== 403 && failureCount < 1;
        },
    });

    const status = (serviceQuery.error as { response?: { status?: number } } | null)
        ?.response?.status;
    const isNotFound = !serviceId?.trim() || (serviceQuery.isError && status === 404);

    return {
        service: serviceQuery.data,
        isNotFound,
        showLoading: Boolean(serviceId?.trim()) && (userId === undefined || serviceQuery.isPending),
        showError: serviceQuery.isError && !isNotFound,
        isFetching: serviceQuery.isFetching,
        refetch: serviceQuery.refetch,
    };
};
