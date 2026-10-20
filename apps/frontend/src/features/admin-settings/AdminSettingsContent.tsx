import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    AdminSettingsTabs,
    type AdminSettingsTab,
} from './components/AdminSettingsTabs';

import { RegistrationSettingsCard } from './components/RegistrationSettingsCard';

export const AdminSettingsContent = () => {
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<AdminSettingsTab>('users');

    return (
        <div className="space-y-6">
            <AdminSettingsTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            {activeTab === 'users' ? (
                <RegistrationSettingsCard />
            ) : (
                <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                    <p className="text-sm text-text-secondary">
                        {t('adminSettings.comingSoon')}
                    </p>
                </section>
            )}
        </div>
    );
};