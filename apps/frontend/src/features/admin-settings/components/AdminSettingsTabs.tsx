import { Bell, Settings, Shield, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type AdminSettingsTab =
    | 'users'
    | 'security'
    | 'system'
    | 'notifications';

type AdminSettingsTabsProps = {
    activeTab: AdminSettingsTab;
    onTabChange: (tab: AdminSettingsTab) => void;
};

const tabs = [
    { id: 'users', labelKey: 'adminSettings.tabs.users', icon: Users },
    { id: 'security', labelKey: 'adminSettings.tabs.security', icon: Shield },
    { id: 'system', labelKey: 'adminSettings.tabs.system', icon: Settings },
    {
        id: 'notifications',
        labelKey: 'adminSettings.tabs.notifications',
        icon: Bell,
    },
] as const;

export const AdminSettingsTabs = ({
    activeTab,
    onTabChange,
}: AdminSettingsTabsProps) => {
    const { t } = useTranslation();

    return (
        <nav
            aria-label={t('adminSettings.tabs.navigationLabel')}
            className="flex gap-1 overflow-x-auto border-b border-white/10"
        >
            {tabs.map(({ id, labelKey, icon: Icon }) => {
                const selected = activeTab === id;

                return (
                    <button
                        key={id}
                        type="button"
                        aria-current={selected ? 'page' : undefined}
                        onClick={() => onTabChange(id)}
                        className={`flex shrink-0 items-center gap-2 border-b-2 px-5 py-4 text-sm font-medium transition-colors ${selected
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-secondary hover:text-white'
                            }`}
                    >
                        <Icon size={18} aria-hidden="true" />
                        <span>{t(labelKey)}</span>
                    </button>
                );
            })}
        </nav>
    );
};