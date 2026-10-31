import { useMemo, useState } from 'react';
import { Blocks, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { PluginRecord } from '@/features/plugins/api/pluginsApi';
import {
    PluginCategoryTabs,
    type PluginCategory,
} from '@/features/plugins/components/PluginCategoryTabs';
import { PluginInstallModal } from '@/features/plugins/components/PluginInstallModal';
import { PluginToggleModal } from '@/features/plugins/components/PluginToggleModal';
import { PluginUninstallModal } from '@/features/plugins/components/PluginUninstallModal';
import { PluginsTable } from '@/features/plugins/components/PluginsTable';
import { usePlugins } from '@/features/plugins/hooks/usePlugins';

export const AdminPluginsPage = () => {
    const { t } = useTranslation();

    const [category, setCategory] =
        useState<PluginCategory>('ALL');

    const [installOpen, setInstallOpen] = useState(false);

    const [togglePlugin, setTogglePlugin] =
        useState<PluginRecord | null>(null);

    const [uninstallPlugin, setUninstallPlugin] =
        useState<PluginRecord | null>(null);

    const {
        plugins,
        loading,
        error,
        refresh,
    } = usePlugins();

    const filteredPlugins = useMemo(
        () =>
            category === 'ALL'
                ? plugins
                : plugins.filter(
                    (plugin) => plugin.type === category,
                ),
        [plugins, category],
    );

    const counts = {
        total: plugins.length,
        active: plugins.filter(
            (plugin) => plugin.status === 'INSTALLED',
        ).length,
        disabled: plugins.filter(
            (plugin) => plugin.status === 'DISABLED',
        ).length,
        installing: plugins.filter(
            (plugin) => plugin.status === 'INSTALLING',
        ).length,
        updating: plugins.filter(
            (plugin) => plugin.status === 'UPDATING',
        ).length,
        failed: plugins.filter(
            (plugin) => plugin.status === 'FAILED',
        ).length,
    };

    const stats = [
        {
            key: 'total',
            value: counts.total,
            className: 'text-text-primary',
        },
        {
            key: 'active',
            value: counts.active,
            className: 'text-green-400',
        },
        {
            key: 'disabled',
            value: counts.disabled,
            className: 'text-slate-400',
        },
        {
            key: 'installing',
            value: counts.installing,
            className: 'text-blue-400',
        },
        {
            key: 'updating',
            value: counts.updating,
            className: 'text-violet-400',
        },
        {
            key: 'failed',
            value: counts.failed,
            className: 'text-red-400',
        },
    ];

    return (
        <div className="space-y-7">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-primary">
                        {t('sidebar.administration')}
                    </p>

                    <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold">
                        <Blocks aria-hidden="true" />
                        {t('adminPlugins.title')}
                    </h1>

                    <p className="mt-2 text-text-secondary">
                        {t('adminPlugins.description')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                        <RefreshCw
                            size={17}
                            aria-hidden="true"
                        />
                        {t('adminPlugins.refresh')}
                    </button>

                    <button
                        type="button"
                        onClick={() => setInstallOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
                    >
                        <Plus size={17} aria-hidden="true" />
                        {t('adminPlugins.install.open')}
                    </button>
                </div>
            </header>

            <section
                aria-label={t('adminPlugins.stats.navigationLabel')}
                className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
            >
                {stats.map((stat) => (
                    <div
                        key={stat.key}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                    >
                        <p className="text-sm text-text-secondary">
                            {t(`adminPlugins.stats.${stat.key}`)}
                        </p>

                        <p
                            className={`mt-2 text-3xl font-bold tabular-nums ${stat.className}`}
                        >
                            {loading || error ? '—' : stat.value}
                        </p>
                    </div>
                ))}
            </section>

            <section className="space-y-5">
                <PluginCategoryTabs
                    activeCategory={category}
                    onCategoryChange={setCategory}
                    plugins={plugins}
                />

                {error ? (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 p-4 text-red-300"
                    >
                        <p className="font-semibold">
                            {t('adminPlugins.errorTitle')}
                        </p>

                        <p className="mt-1 text-sm">
                            {t('adminPlugins.errorDescription')}
                        </p>
                    </div>
                ) : (
                    <PluginsTable
                        plugins={filteredPlugins}
                        loading={loading}
                        onToggle={setTogglePlugin}
                        onUninstall={setUninstallPlugin}
                    />
                )}
            </section>

            <PluginInstallModal
                open={installOpen}
                onClose={() => setInstallOpen(false)}
                onInstalled={() => {
                    setCategory('ALL');
                    refresh();
                }}
            />

            <PluginToggleModal
                plugin={togglePlugin}
                onClose={() => setTogglePlugin(null)}
                onChanged={refresh}
            />

            <PluginUninstallModal
                plugin={uninstallPlugin}
                onClose={() => setUninstallPlugin(null)}
                onChanged={refresh}
            />
        </div>
    );
};