
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createServiceInstallJob } from '@/features/services/api/services.api';
import { useUser } from '@/shared/store/user';

export const useCreateServiceInstallJob = (serviceId?: string) => {
    const queryClient = useQueryClient();
    const userId = useUser((state) => state.user?.id);

    return useMutation({
        mutationFn: async () => {
            if (!serviceId?.trim()) {
                throw new Error('Service ID is missing');
            }

            return createServiceInstallJob(serviceId);
        },

        onSuccess: async () => {
            toast.success('Installation requested', {
                description: 'The installation job is waiting for execution.',
            });

            await queryClient.invalidateQueries({
                queryKey: ['active-service-install-job', userId, serviceId],
            });
        },

        onError: (error) => {
            const status = (error as {
                response?: { status?: number };
            })?.response?.status;

            if (status === 409) {
                toast.error('Installation already requested', {
                    description: 'An active installation job already exists.',
                });
                return;
            }

            toast.error('Unable to request installation', {
                description: 'Please try again later.',
            });
        },
    });
};
