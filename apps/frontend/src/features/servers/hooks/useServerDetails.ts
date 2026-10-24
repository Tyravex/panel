import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { getUserServer } from "../api/servers.api";
import { previewServers } from "../mock/servers.mock";

export const useServerDetails = (id: string | undefined, isDemoMode: boolean) => {
    const serverId = id ? Number(id) : NaN;
    const isValidServerId = Number.isSafeInteger(serverId) && serverId > 0;
    const previewServer = isDemoMode && isValidServerId
        ? previewServers.find((item) => item.id === serverId)
        : undefined;

    const { data: realServer, isPending, isError, error, isFetching, refetch } = useQuery({
        queryKey: ["server", serverId],
        queryFn: () => getUserServer(serverId),
        enabled: isValidServerId && !isDemoMode,
        retry: 1,
        staleTime: 30_000,
    });

    const server = isDemoMode ? previewServer : realServer;
    const isNotFound = !isValidServerId || (isDemoMode && !previewServer) ||
        (!isDemoMode && error instanceof AxiosError && (error.response?.status === 404 || error.response?.status === 403));
    const showError = !isValidServerId || (isDemoMode && !previewServer) || (!isDemoMode && isError);
    const showLoading = !isDemoMode && isPending;

    return {
        server,
        previewServer,
        isValidServerId,
        isNotFound,
        showError,
        showLoading,
        isFetching,
        refetch,
    };
};
