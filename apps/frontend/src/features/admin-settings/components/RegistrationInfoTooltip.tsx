import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const RegistrationInfoTooltip = () => {
    const { t } = useTranslation();

    return (
        <span className="group relative inline-flex items-center">
            <button
                type="button"
                aria-label={t('adminSettings.infoTitle')}
                aria-describedby="registration-info-tooltip"
                className="rounded-full p-1 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
                <Info size={17} aria-hidden="true" />
            </button>

            <span
                id="registration-info-tooltip"
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-20 mb-3 w-64 rounded-xl border border-white/15 bg-[#17243a] p-3 text-left text-xs leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:w-72"
            >
                <span className="mb-1 block font-semibold">
                    {t('adminSettings.infoTitle')}
                </span>

                {t('adminSettings.registrationInfo')}
            </span>
        </span>
    );
};