import { useQuery } from "@tanstack/react-query";

import { getActiveServiceInstallJob } from "@/features/services/api/services.api";
import { useUser } from "@/shared/store/user";

const ACTIVE_JOB_POLL_INTERVAL = 3_000;
const IDLE_JOB_POLL_INTERVAL = 15_000;

const ACTIVE_JOB_STATUSES = new Set([
    "PENDING",
    "DISPATCHING",
    "QUEUED",
    "RUNNING",
]);

export const useActiveServiceInstallJob = (serviceId?: string) => {
    const userId = useUser((state) => state.user?.id);

    const enabled =
        userId !== undefined &&
        Boolean(serviceId?.trim());

    return useQuery({
        queryKey: [
            "active-service-install-job",
            userId,
            serviceId,
        ],

        queryFn: () => getActiveServiceInstallJob(serviceId!),

        enabled,

        staleTime: 3_000,

        // Poll frequently while an installation job is active.
        // Use a longer interval when no active job is available.
        refetchInterval: (query) => {
            if (!enabled) {
                return false;
            }

            // Avoid continuous polling after authorization errors.
            const error = query.state.error as {
                response?: {
                    status?: number;
                };
            } | null;

            const errorStatus = error?.response?.status;

            if (
                errorStatus === 401 ||
                errorStatus === 403
            ) {
                return false;
            }

            const job = query.state.data;

            if (
                job?.status &&
                ACTIVE_JOB_STATUSES.has(job.status)
            ) {
                return ACTIVE_JOB_POLL_INTERVAL;
            }

            return IDLE_JOB_POLL_INTERVAL;
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
};
