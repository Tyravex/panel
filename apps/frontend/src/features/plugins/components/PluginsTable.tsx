import {
    Bell,
    Box,
    CreditCard,
    Languages,
    Palette,
    Plug,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type {
    PluginRecord,
    PluginType,
} from '../api/pluginsApi';
import { PluginActionsMenu } from './PluginActionsMenu';
import { PluginStatusBadge } from './PluginStatusBadge';

interface PluginsTableProps {
    plugins: PluginRecord[];
    loading: boolean;
    actionsDisabled?: boolean;
    onToggle: (plugin: PluginRecord) => void;
    onUninstall: (plugin: PluginRecord) => void;
}

const TYPE_ICONS = {
    LANGUAGE: Languages,
    THEME: Palette,
    INTEGRATION: Plug,
    BILLING: CreditCard,
    NOTIFICATION: Bell,
    OTHER: Box,
} satisfies Record<PluginType, typeof Box>;

export const PluginsTable = ({
    plugins,
    loading,
    actionsDisabled = false,
    onToggle,
    onUninstall,
}: PluginsTableProps) => {
    const { t } = useTranslation();

    if (loading) {
        return (
            <div
                role="status"
                className="rounded-2xl border border-white/10 p-6 text-sm text-text-secondary"
            >
                {t('adminPlugins.loading')}
            </div>
        );
    }

    if (plugins.length === 0) {
        return (
            <div className="rounded-2xl border border-white/10 px-6 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.05]">
                    <Box
                        size={22}
                        className="text-text-secondary"
                        aria-hidden="true"
                    />
                </div>

                <p className="mt-4 font-semibold">
                    {t('adminPlugins.emptyTitle')}
                </p>

                <p className="mt-2 text-sm text-text-secondary">
                    {t('adminPlugins.emptyDescription')}
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.015]">
            {plugins.map((plugin, index) => {
                const TypeIcon =
                    TYPE_ICONS[plugin.type] ?? Box;

                return (
                    <div
                        key={plugin.id}
                        className={[
                            'group flex min-h-[76px] items-center',
                            'gap-3 px-4 py-3 transition-colors',
                            'hover:bg-white/[0.035]',
                            index > 0
                                ? 'border-t border-white/[0.07]'
                                : '',
                        ].join(' ')}
                    >
                        <div
                            className={[
                                'flex h-11 w-11 shrink-0 items-center',
                                'justify-center rounded-xl',
                                'border border-primary/15',
                                'bg-primary/[0.08] text-primary',
                            ].join(' ')}
                        >
                            <TypeIcon
                                size={20}
                                strokeWidth={1.8}
                                aria-hidden="true"
                            />
                        </div>

                        <div className="min-w-0 flex-1">
                            <Link
                                to={`/admin/plugins/${encodeURIComponent(plugin.id)}`}
                                className={[
                                    'block truncate text-sm font-semibold',
                                    'text-text-primary',
                                    'transition-colors hover:text-primary',
                                ].join(' ')}
                                title={plugin.id}
                            >
                                {plugin.id}
                            </Link>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                                <span>
                                    {t(
                                        `adminPlugins.types.${plugin.type}`,
                                    )}
                                </span>

                                <span
                                    aria-hidden="true"
                                    className="text-white/20"
                                >
                                    ·
                                </span>

                                <span>v{plugin.version}</span>
                            </div>
                        </div>

                        <div className="ml-auto shrink-0">
                            <PluginStatusBadge
                                status={plugin.status}
                            />
                        </div>

                        <div className="ml-1 shrink-0 border-l border-white/10 pl-2">
                            <PluginActionsMenu
                                plugin={plugin}
                                disabled={actionsDisabled}
                                onToggle={onToggle}
                                onUninstall={onUninstall}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};