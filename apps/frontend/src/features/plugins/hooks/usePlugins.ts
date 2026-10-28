import { useCallback, useEffect, useState } from 'react';

import {
    pluginsApi,
    type PluginRecord,
} from '../api/pluginsApi';

export const usePlugins = () => {
    const [plugins, setPlugins] = useState<PluginRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshIndex, setRefreshIndex] = useState(0);

    const refresh = useCallback(() => {
        setRefreshIndex((previous) => previous + 1);
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        setLoading(true);
        setError(false);

        void pluginsApi
            .list(controller.signal)
            .then((records) => {
                if (!controller.signal.aborted) {
                    setPlugins(records);
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

    return {
        plugins,
        loading,
        error,
        refresh,
    };
};