import { ArrowLeft, Blocks, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { usePluginDetails } from "@/features/plugins/hooks/usePluginDetails";

export const AdminPluginDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { plugin, loading, error, refresh } = usePluginDetails(id);

    const details = plugin
        ? [
            {
                label: t("adminPlugins.name"),
                value: plugin.id,
            },
            {
                label: t("adminPlugins.type"),
                value: t(`adminPlugins.types.${plugin.type}`),
            },
            {
                label: t("adminPlugins.version"),
                value: plugin.version,
            },
            {
                label: t("adminPlugins.status"),
                value: t(`adminPlugins.statuses.${plugin.status}`),
            },
            {
                label: "Source repository",
                value: plugin.sourceRepository ?? "—",
            },
            {
                label: "Installed at",
                value: new Date(plugin.installedAt).toLocaleString(),
            },
            {
                label: "Updated at",
                value: new Date(plugin.updatedAt).toLocaleString(),
            },
        ]
        : [];

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                    <Link
                        to="/admin/plugins"
                        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-primary"
                    >
                        <ArrowLeft size={16} aria-hidden="true" />
                        {t("adminPlugins.title")}
                    </Link>

                    <h1 className="flex items-center gap-3 text-3xl font-bold">
                        <Blocks aria-hidden="true" />
                        {plugin?.id ?? id ?? t("adminPlugins.title")}
                    </h1>
                </div>

                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading || !id}
                    className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 disabled:opacity-50"
                >
                    <RefreshCw size={17} aria-hidden="true" />
                    {t("adminPlugins.refresh")}
                </button>
            </header>

            {loading && (
                <p role="status" className="text-text-secondary">
                    {t("adminPlugins.loading")}
                </p>
            )}

            {!loading && error && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 p-4"
                >
                    <p className="font-semibold">
                        {error === "not-found"
                            ? "Plugin not found"
                            : t("adminPlugins.errorTitle")}
                    </p>
                    <p className="mt-2 text-sm text-text-secondary">
                        {error === "not-found"
                            ? "The requested plugin does not exist."
                            : t("adminPlugins.errorDescription")}
                    </p>
                </div>
            )}

            {!loading && !error && plugin && (
                <section className="overflow-hidden rounded-xl border border-border-subtle">
                    <dl className="divide-y divide-border-subtle">
                        {details.map((detail) => (
                            <div
                                key={detail.label}
                                className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4"
                            >
                                <dt className="text-sm text-text-secondary">
                                    {detail.label}
                                </dt>
                                <dd className="break-words text-sm font-medium">
                                    {detail.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}
        </div>
    );
};
