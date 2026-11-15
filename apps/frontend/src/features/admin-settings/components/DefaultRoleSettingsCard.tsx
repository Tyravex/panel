import { Loader2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useDefaultRole } from '../hooks/useDefaultRole';
import { useEffect } from 'react';

export const DefaultRoleSettingsCard = ({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) => {
    const { t } = useTranslation();

    const {
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
    } = useDefaultRole();
    const dirty = !loading && !!currentRole && selectedRoleId !== currentRole.id;
    useEffect(() => {
        onDirtyChange?.(dirty);
        return () => onDirtyChange?.(false);
    }, [dirty, onDirtyChange]);

    return (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
            <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-300">
                    <ShieldCheck size={27} aria-hidden="true" />
                </div>

                <div className="min-w-0">
                    <h2 className="text-lg font-semibold">
                        {t('adminSettings.defaultRoleTitle')}
                    </h2>

                    <p className="mt-1 text-sm text-text-secondary">
                        {t('adminSettings.defaultRoleDescription')}
                    </p>
                </div>
            </div>

            {loading ? (
                <p className="mt-5 flex items-center gap-2 text-sm text-text-secondary">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    {t('adminSettings.loading')}
                </p>
            ) : loadFailed ? (
                <p role="alert" className="mt-5 text-sm text-red-400">
                    {t('adminSettings.defaultRoleLoadError')}
                </p>
            ) : (
                <div className="mt-6 space-y-4">
                    <p className="text-sm text-text-secondary">
                        {t('adminSettings.defaultRoleCurrent')}{' '}
                        <span className="font-medium text-white">
                            {currentRole?.name}
                        </span>
                    </p>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="flex-1 space-y-2">
                            <span className="block text-sm font-medium">
                                {t('adminSettings.defaultRoleSelect')}
                            </span>

                            <select
                                value={selectedRoleId}
                                onChange={(event) => {
                                    setSelectedRoleId(event.target.value);
                                }}
                                disabled={saving || eligibleRoles.length === 0}
                                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm text-white outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {!eligibleRoles.some(
                                    (role) => role.id === selectedRoleId,
                                ) && (
                                        <option value={selectedRoleId} disabled>
                                            {currentRole?.name ??
                                                t('adminSettings.defaultRoleUnavailable')}
                                        </option>
                                    )}

                                {eligibleRoles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            type="button"
                            onClick={() => void saveDefaultRole()}
                            disabled={!canSave}
                            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {saving
                                ? t('adminSettings.saving')
                                : t('adminSettings.defaultRoleSave')}
                        </button>
                    </div>

                    {eligibleRoles.length === 0 && (
                        <p className="text-sm text-text-secondary">
                            {t('adminSettings.defaultRoleNoEligible')}
                        </p>
                    )}

                    <p className="text-xs text-text-secondary">
                        {t('adminSettings.defaultRoleHint')}
                    </p>
                </div>
            )}

            {error && !loadFailed && (
                <p role="alert" className="mt-4 text-sm text-red-400">
                    {error}
                </p>
            )}

            {success && (
                <p role="status" className="mt-4 text-sm text-emerald-400">
                    {success}
                </p>
            )}
        </section>
    );
};
