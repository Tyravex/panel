import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { createServiceInstallJob } from "@/features/services/api/services.api";
import { useUser } from "@/shared/store/user";

export const useCreateServiceInstallJob = (serviceId?: string) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const userId = useUser((state) => state.user?.id);

    return useMutation({
        mutationFn: async () => {
            if (!serviceId?.trim()) {
                throw new Error("Service ID is missing");
            }

            return createServiceInstallJob(serviceId);
        },

        onSuccess: async () => {
            toast.success(
                t("services.installation.notifications.requested.title"),
                {
                    description: t(
                        "services.installation.notifications.requested.description",
                    ),
                },
            );

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: [
                        "active-service-install-job",
                        userId,
                        serviceId,
                    ],
                }),
                queryClient.invalidateQueries({
                    queryKey: [
                        "user-service",
                        userId,
                        serviceId,
                    ],
                }),
            ]);
        },

        onError: (error) => {
            const status = (
                error as {
                    response?: {
                        status?: number;
                    };
                }
            )?.response?.status;

            if (status === 409) {
                toast.error(
                    t(
                        "services.installation.notifications.alreadyRequested.title",
                    ),
                    {
                        description: t(
                            "services.installation.notifications.alreadyRequested.description",
                        ),
                    },
                );

                void Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: [
                            "active-service-install-job",
                            userId,
                            serviceId,
                        ],
                    }),
                    queryClient.invalidateQueries({
                        queryKey: [
                            "user-service",
                            userId,
                            serviceId,
                        ],
                    }),
                ]);

                return;
            }

            toast.error(
                t("services.installation.notifications.requestFailed.title"),
                {
                    description: t(
                        "services.installation.notifications.requestFailed.description",
                    ),
                },
            );
        },
    });
};
