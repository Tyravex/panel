import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
    getDefaultRoleApi,
    getEligibleDefaultRolesApi,
    updateDefaultRoleApi,
    type DefaultRole,
} from '../api/defaultRole.api';

export const useDefaultRole = () => {
    const { t } = useTranslation();

    const [currentRole, setCurrentRole] = useState<DefaultRole | null>(null);
    const [eligibleRoles, setEligibleRoles] = useState<DefaultRole[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        let active = true;

        Promise.all([
            getDefaultRoleApi(),
            getEligibleDefaultRolesApi(),
        ])
            .then(([current, eligible]) => {
                if (!active) return;

                setCurrentRole(current.data);
                setEligibleRoles(eligible.data);
                setSelectedRoleId(current.data.id);
                setLoadFailed(false);
            })
            .catch(() => {
                if (!active) return;

                setLoadFailed(true);
                setError(t('adminSettings.defaultRoleLoadError'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [t]);

    const saveDefaultRole = async () => {
        if (
            loading ||
            loadFailed ||
            saving ||
            !currentRole ||
            !selectedRoleId ||
            selectedRoleId === currentRole.id ||
            !eligibleRoles.some((role) => role.id === selectedRoleId)
        ) {
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const { data } = await updateDefaultRoleApi(selectedRoleId);
            setCurrentRole(data);
            setSelectedRoleId(data.id);
            setSuccess(t('adminSettings.defaultRoleSaveSuccess'));

            // Refresh eligibility after the update; role permissions may
            // have changed in another administrator session.
            try {
                const eligible = await getEligibleDefaultRolesApi();
                setEligibleRoles(eligible.data);
            } catch {
                setLoadFailed(true);
                setError(t('adminSettings.defaultRoleLoadError'));
            }
        } catch {
            setError(t('adminSettings.defaultRoleSaveError'));
        } finally {
            setSaving(false);
        }
    };

    const canSave =
        !loading &&
        !loadFailed &&
        !saving &&
        currentRole !== null &&
        selectedRoleId !== currentRole.id &&
        eligibleRoles.some((role) => role.id === selectedRoleId);

    return {
        currentRole,
        eligibleRoles,
        selectedRoleId,
        setSelectedRoleId,
        loading,
        loadFailed,
        saving,
        error,
        success,
        canSave,
        saveDefaultRole,
    };
};
