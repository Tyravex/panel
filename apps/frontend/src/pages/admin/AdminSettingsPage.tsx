import { useTranslation } from 'react-i18next';
import { AdminSettingsContent } from '@/features/admin-settings/AdminSettingsContent';

export const AdminSettingsPage = () => {
    const { t } = useTranslation();

    return (
        <div className="space-y-7">
            <header>
                <h1 className="text-3xl font-bold">
                    {t('adminSettings.title')}
                </h1>

                <p className="mt-2 text-text-secondary">
                    {t('adminSettings.description')}
                </p>
            </header>

            <AdminSettingsContent />
        </div>
    );
};