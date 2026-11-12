import { useActiveServiceInstallJob } from "@/features/services/hooks/useActiveServiceInstallJob";
import { useCreateServiceInstallJob } from "@/features/services/hooks/useCreateServiceInstallJob";

export const useServiceInstallation = (
    serviceId: string,
    installStatus?: string | null,
) => {
    const activeInstallJob = useActiveServiceInstallJob(serviceId);
    const createInstallJob = useCreateServiceInstallJob(serviceId);

    const job = activeInstallJob.data;

    const isInstallableStatus =
        installStatus === "DRAFT" ||
        installStatus === "FAILED";

    const isCheckingJob =
        activeInstallJob.isPending ||
        activeInstallJob.isFetching;

    const hasJobLookupError = activeInstallJob.isError;

    const hasActiveJob = job != null;

    const canRequestInstallation =
        Boolean(serviceId.trim()) &&
        isInstallableStatus &&
        !isCheckingJob &&
        !hasJobLookupError &&
        !hasActiveJob &&
        !createInstallJob.isPending &&
        !createInstallJob.isSuccess;

    const requestInstallation = () => {
        if (!canRequestInstallation) {
            return;
        }

        createInstallJob.mutate();
    };

    const retryJobLookup = () => {
        if (activeInstallJob.isFetching) {
            return;
        }

        void activeInstallJob.refetch();
    };

    return {
        job,
        activeInstallJob,
        createInstallJob,
        isCheckingJob,
        hasJobLookupError,
        hasActiveJob,
        canRequestInstallation,
        requestInstallation,
        retryJobLookup,
    };
};
