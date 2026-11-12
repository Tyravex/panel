import { useQuery } from '@tanstack/react-query';
import { getUserServices } from '@/features/services/api/services.api';
import { countServiceCategories } from '@/features/services/lib/countServiceCategories';

// The dashboard reads hosted workloads exclusively through the Service API.
export const useServiceDashboardData = (userId?: number) => {
  const servicesQuery = useQuery({
    queryKey: ['user-services', userId],
    queryFn: getUserServices,
    enabled: userId !== undefined,
    staleTime: 30_000,
    retry: 1,
  });

  const services = servicesQuery.data ?? [];
  const categoryCounts = countServiceCategories(services);

  return { servicesQuery, services, categoryCounts };
};
