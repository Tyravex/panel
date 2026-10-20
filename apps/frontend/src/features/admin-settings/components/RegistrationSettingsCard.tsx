import { Check, Loader2, UserRoundPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRegistrationSettings } from '../hooks/useRegistrationSettings';
import { RegistrationInfoTooltip } from './RegistrationInfoTooltip';

export const RegistrationSettingsCard = () => {
    const { t } = useTranslation();

    const {
        registrationEnabled,
        loading,
        loadFailed,
        saving,
        error,
        success,
        toggleRegistration,
    } = useRegistrationSettings();

    return (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/15 text-violet-300">
                        <UserRoundPlus size={27} aria-hidden="true" />
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">
                                {t('adminSettings.registrationTitle')}
                            </h2>

                            <RegistrationInfoTooltip />
                        </div>

                        <p className="mt-1 text-sm text-text-secondary">
                            {t('adminSettings.registrationDescription')}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-4 border-t border-white/10 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                    {loading ? (
                        <span className="flex items-center gap-2 text-sm text-text-secondary">
                            <Loader2
                                size={16}
                                className="animate-spin"
                                aria-hidden="true"
                            />
                            {t('adminSettings.loading')}
                        </span>
                    ) : loadFailed ? (
                        <span className="text-sm text-red-400">
                            {t('adminSettings.loadError')}
                        </span>
                    ) : (
                        <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${registrationEnabled
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                    : 'border-white/10 bg-white/5 text-text-secondary'
                                }`}
                        >
                            {registrationEnabled ? (
                                <Check size={15} aria-hidden="true" />
                            ) : (
                                <X size={15} aria-hidden="true" />
                            )}

                            {registrationEnabled
                                ? t('adminSettings.enabled')
                                : t('adminSettings.disabled')}
                        </span>
                    )}

                    <button
                        type="button"
                        role="switch"
                        aria-checked={registrationEnabled}
                        aria-label={t('adminSettings.registrationTitle')}
                        aria-busy={saving}
                        onClick={() => void toggleRegistration()}
                        disabled={loading || loadFailed || saving}
                        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${registrationEnabled
                                ? 'bg-primary'
                                : 'bg-gray-600'
                            }`}
                    >
                        <span
                            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${registrationEnabled
                                    ? 'left-7'
                                    : 'left-1'
                                }`}
                        />
                    </button>
                </div>
            </div>

            {saving && (
                <p className="mt-4 text-sm text-text-secondary">
                    {t('adminSettings.saving')}
                </p>
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