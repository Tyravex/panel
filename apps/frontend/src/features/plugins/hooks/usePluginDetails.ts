import { useEffect, useState } from "react";

import {
    pluginsApi,
    type PluginRecord,
} from "../api/pluginsApi";

export const usePluginDetails = (id: string | undefined) => {
    const [plugin, setPlugin] = useState<PluginRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<"not-found" | "request" | null>(null);
    const [refreshIndex, setRefreshIndex] = useState(0);

    useEffect(() => {
        if (!id) {
            return;
        }

        const controller = new AbortController();

        void pluginsApi
            .getById(id, controller.signal)
            .then((record) => {
                if (!controller.signal.aborted) {
                    setPlugin(record);
                    setError(null);
                }
            })
            .catch((reason: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                const status =
                    typeof reason === "object" &&
                        reason !== null &&
                        "response" in reason
                        ? (reason as { response?: { status?: number } })
                            .response?.status
                        : undefined;

                setPlugin(null);
                setError(status === 404 ? "not-found" : "request");
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [id, refreshIndex]);

    return {
        plugin: id ? plugin : null,
        loading: Boolean(id) && loading,
        error: id ? error : "not-found",
        refresh: () => {
            setLoading(true);
            setError(null);
            setPlugin(null);
            setRefreshIndex((previous) => previous + 1);
        },
    };
};
