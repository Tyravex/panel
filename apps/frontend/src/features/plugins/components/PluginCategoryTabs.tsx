import {
    Blocks,
    CreditCard,
    Languages,
    Palette,
    Plug,
    Bell,
    Package,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type {
    PluginRecord,
    PluginType,
} from '../api/pluginsApi';

export type PluginCategory = 'ALL' | PluginType;

interface PluginCategoryTabsProps {
    activeCategory: PluginCategory;
    onCategoryChange: (category: PluginCategory) => void;
    plugins: PluginRecord[];
}

const categories = [
    { id: 'ALL', icon: Blocks },
    { id: 'LANGUAGE', icon: Languages },
    { id: 'THEME', icon: Palette },
    { id: 'INTEGRATION', icon: Plug },
    { id: 'BILLING', icon: CreditCard },
    { id: 'NOTIFICATION', icon: Bell },
    { id: 'OTHER', icon: Package },
] as const;

export const PluginCategoryTabs = ({
    activeCategory,
    onCategoryChange,
    plugins,
}: PluginCategoryTabsProps) => {
    const { t } = useTranslation();

    return (
        <nav
            aria-label={t('adminPlugins.categories.navigationLabel')}
            className="flex gap-1 overflow-x-auto border-b border-white/10"
        >
            {categories.map(({ id, icon: Icon }) => {
                const selected = activeCategory === id;

                const count =
                    id === 'ALL'
                        ? plugins.length
                        : plugins.filter(
                            (plugin) => plugin.type === id,
                        ).length;

                const label =
                    id === 'ALL'
                        ? t('adminPlugins.categories.all')
                        : t(`adminPlugins.types.${id}`);

                return (
                    <button
                        key={id}
                        type="button"
                        aria-current={selected ? 'page' : undefined}
                        onClick={() => onCategoryChange(id)}
                        className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium transition-colors ${selected
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-white'
                            }`}
                    >
                        <Icon size={17} aria-hidden="true" />
                        <span>{label}</span>
                        <span
                            className="rounded-md bg-white/5 px-2 py-0.5 text-xs"
                            aria-label={t(
                                'adminPlugins.categories.count',
                                { count },
                            )}
                        >
                            {count}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
};