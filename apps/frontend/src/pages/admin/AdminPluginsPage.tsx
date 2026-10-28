import { Blocks, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PluginsTable } from '@/features/plugins/components/PluginsTable';
import { usePlugins } from '@/features/plugins/hooks/usePlugins';

export const AdminPluginsPage = () => {
    const { t } = useTranslation();

    const {
        plugins,
        loading,
        error,
        refresh,
    } = usePlugins();

    return (
        <div className="space-y-6">
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

                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-border-subtle px-4 py-2 disabled:opacity-50"
                >
                    <RefreshCw size={17} aria-hidden="true" />
                    {t('adminPlugins.refresh')}
                </button>
            </header>

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
                    plugins={plugins}
                    loading={loading}
                />
            )}
        </div>
    );
};