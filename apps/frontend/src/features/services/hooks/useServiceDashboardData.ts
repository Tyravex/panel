import { useQuery } from '@tanstack/react-query';
import { getUserServers } from '@/features/servers/api/servers.api';
import { getUserServices } from '@/features/services/api/services.api';
import { countServiceCategories } from '@/features/services/lib/countServiceCategories';

// Keep API requests and legacy-server reconciliation outside page components.
export const useServiceDashboardData = (userId?: number) => {
    const servicesQuery = useQuery({
        queryKey: ['user-services', userId],
        queryFn: getUserServices,
        enabled: userId !== undefined,
        staleTime: 30_000,
        retry: 1,
    });
    const serversQuery = useQuery({
        queryKey: ['user-servers', userId],
        queryFn: getUserServers,
        enabled: userId !== undefined,
        staleTime: 30_000,
        retry: 1,
    });
    const services = servicesQuery.data ?? [];
    const legacyServers = serversQuery.data ?? [];
    const linkedIds = new Set(
        services.filter((service) => service.category?.key === 'server')
            .map((service) => service.serverId)
            .filter((id): id is number => id !== null),
    );
    const standaloneServers = legacyServers.filter((server) => !linkedIds.has(server.id));
    const newServerServices = services.filter((service) => service.category?.key === 'server');
    const categoryCounts = countServiceCategories(services, standaloneServers.length);
    return { servicesQuery, serversQuery, services, standaloneServers, newServerServices, categoryCounts };
};
