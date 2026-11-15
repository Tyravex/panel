import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    AdminSettingsTabs,
    type AdminSettingsTab,
} from './components/AdminSettingsTabs';

import { RegistrationSettingsCard } from './components/RegistrationSettingsCard';
import { DefaultRoleSettingsCard } from './components/DefaultRoleSettingsCard';
import { EggUpdateSettingsCard } from './components/EggUpdateSettingsCard';
import { useUnsavedChanges } from '@/shared/lib/useUnsavedChanges';

export const AdminSettingsContent = () => {
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<AdminSettingsTab>('users');
    const [dirty, setDirty] = useState(false);
    const unsaved = useUnsavedChanges(dirty);

    return (
        <div className="space-y-6">
            <AdminSettingsTabs
                activeTab={activeTab}
                onTabChange={(tab) => { if (tab !== activeTab) unsaved.requestAction(() => setActiveTab(tab)); }}
            />

            {activeTab === 'users' ? (
                <div className="space-y-6">
                    <RegistrationSettingsCard />
                    <DefaultRoleSettingsCard onDirtyChange={setDirty} />
                </div>
            ) : activeTab === 'eggs' ? <EggUpdateSettingsCard onDirtyChange={setDirty} /> : (
                <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                    <p className="text-sm text-text-secondary">
                        {t('adminSettings.comingSoon')}
                    </p>
                </section>
            )}
        </div>
    );
};
