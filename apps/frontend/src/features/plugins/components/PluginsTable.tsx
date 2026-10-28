import { useTranslation } from 'react-i18next';

import type { PluginRecord } from '../api/pluginsApi';

interface PluginsTableProps {
    plugins: PluginRecord[];
    loading: boolean;
}

export const PluginsTable = ({
    plugins,
    loading,
}: PluginsTableProps) => {
    const { t } = useTranslation();

    if (loading) {
        return (
            <p role="status" className="text-text-secondary">
                {t('adminPlugins.loading')}
            </p>
        );
    }

    if (plugins.length === 0) {
        return (
            <div className="rounded-xl border border-border-subtle p-8 text-center">
                <p className="font-semibold">
                    {t('adminPlugins.emptyTitle')}
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                    {t('adminPlugins.emptyDescription')}
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border-subtle">
                    <tr>
                        <th scope="col" className="px-4 py-3">
                            {t('adminPlugins.name')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                            {t('adminPlugins.type')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                            {t('adminPlugins.version')}
                        </th>
                        <th scope="col" className="px-4 py-3">
                            {t('adminPlugins.status')}
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {plugins.map((plugin) => (
                        <tr
                            key={plugin.id}
                            className="border-b border-border-subtle last:border-0"
                        >
                            <td className="px-4 py-3 font-medium">
                                {plugin.id}
                            </td>
                            <td className="px-4 py-3">
                                {t(`adminPlugins.types.${plugin.type}`)}
                            </td>
                            <td className="px-4 py-3">
                                {plugin.version}
                            </td>
                            <td className="px-4 py-3">
                                {t(`adminPlugins.statuses.${plugin.status}`)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};