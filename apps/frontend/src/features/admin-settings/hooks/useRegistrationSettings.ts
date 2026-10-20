import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getRegistrationSettingsApi,
    updateRegistrationSettingsApi,
} from '../api/registrationSettings.api';

export const useRegistrationSettings = () => {
    const { t } = useTranslation();

    const [registrationEnabled, setRegistrationEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        let active = true;

        getRegistrationSettingsApi()
            .then(({ data }) => {
                if (!active) return;

                setRegistrationEnabled(data.registrationEnabled);
                setLoadFailed(false);
            })
            .catch(() => {
                if (!active) return;

                setLoadFailed(true);
                setError(t('adminSettings.loadError'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [t]);

    const toggleRegistration = async () => {
        if (loading || loadFailed || saving) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const { data } = await updateRegistrationSettingsApi(
                !registrationEnabled,
            );

            setRegistrationEnabled(data.registrationEnabled);
            setSuccess(t('adminSettings.saveSuccess'));
        } catch {
            setError(t('adminSettings.saveError'));
        } finally {
            setSaving(false);
        }
    };

    return {
        registrationEnabled,
        loading,
        loadFailed,
        saving,
        error,
        success,
        toggleRegistration,
    };
};