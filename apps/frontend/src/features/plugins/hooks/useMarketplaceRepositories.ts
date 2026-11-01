import { useCallback, useEffect, useState } from 'react';

import type {
    CreateMarketplaceRepositoryRequest,
    MarketplaceRepository,
    UpdateMarketplaceRepositoryRequest,
} from '@shared/types';

import { marketplaceApi } from '../api/marketplaceApi';

export const useMarketplaceRepositories = () => {
    const [repositories, setRepositories] = useState<
        MarketplaceRepository[]
    >([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const [refreshIndex, setRefreshIndex] = useState(0);

    const refresh = useCallback(() => {
        setRefreshIndex((previous) => previous + 1);
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setError(false);

        void marketplaceApi
            .listRepositories(controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) {
                    setRepositories(result.repositories);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setError(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [refreshIndex]);

    const createRepository = useCallback(
        async (data: CreateMarketplaceRepositoryRequest) => {
            setSaving(true);

            try {
                const created = await marketplaceApi.createRepository(data);
                refresh();
                return created;
            } finally {
                setSaving(false);
            }
        },
        [refresh],
    );

    const updateRepository = useCallback(
        async (
            id: string,
            data: UpdateMarketplaceRepositoryRequest,
        ) => {
            setSaving(true);

            try {
                const updated = await marketplaceApi.updateRepository(id, data);
                refresh();
                return updated;
            } finally {
                setSaving(false);
            }
        },
        [refresh],
    );

    const deleteRepository = useCallback(
        async (id: string): Promise<void> => {
            setSaving(true);

            try {
                await marketplaceApi.deleteRepository(id);
                refresh();
            } finally {
                setSaving(false);
            }
        },
        [refresh],
    );

    return {
        repositories,
        loading,
        saving,
        error,
        refresh,
        createRepository,
        updateRepository,
        deleteRepository,
    };

};