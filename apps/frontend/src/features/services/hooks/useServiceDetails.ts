import { useQuery } from "@tanstack/react-query";

import { getUserService } from "@/features/services/api/services.api";
import { useUser } from "@/shared/store/user";

export const useServiceDetails = (serviceId?: string) => {
    const userId = useUser((state) => state.user?.id);

    const enabled =
        userId !== undefined &&
        Boolean(serviceId?.trim());

    const serviceQuery = useQuery({
        queryKey: ["user-service", userId, serviceId],

        queryFn: () => getUserService(serviceId!),

        enabled,

        staleTime: 5_000,

        // Keep checking the installation status until the service is installed.
        refetchInterval: (query) => {
            if (!enabled) {
                return false;
            }

            const service = query.state.data;

            if (service?.installStatus === "INSTALLED") {
                return false;
            }

            return 5_000;
        },

        // Do not retry authorization or missing-resource errors.
        retry: (failureCount, error) => {
            const status = (
                error as {
                    response?: {
                        status?: number;
                    };
                }
            )?.response?.status;

            if (
                status === 401 ||
                status === 403 ||
                status === 404
            ) {
                return false;
            }

            return failureCount < 1;
        },
    });

    const status = (
        serviceQuery.error as {
            response?: {
                status?: number;
            };
        } | null
    )?.response?.status;

    const isNotFound =
        !serviceId?.trim() ||
        (serviceQuery.isError && status === 404);

    return {
        service: serviceQuery.data,

        isNotFound,

        showLoading:
            Boolean(serviceId?.trim()) &&
            (
                userId === undefined ||
                serviceQuery.isPending
            ),

        showError:
            serviceQuery.isError &&
            !isNotFound,

        isFetching: serviceQuery.isFetching,

        refetch: serviceQuery.refetch,
    };
};
