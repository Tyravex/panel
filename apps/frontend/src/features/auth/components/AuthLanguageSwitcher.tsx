import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Languages, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LanguageOption } from '@/features/auth/api/getLanguageOptions';
import {
    fallbackLanguage,
    getAvailableLanguageOptions,
} from '@/shared/i18n/availableLanguages';
import { useUser } from '@/shared/store/user';

const countryByLanguage: Record<string, string> = {
    en: 'gb',
    pl: 'pl',
    de: 'de',
};

const fallbackOption: LanguageOption = {
    ...fallbackLanguage,
    enabled: true,
};

export const AuthLanguageSwitcher = () => {
    const { t } = useTranslation();

    const language = useUser((state) => state.activeLanguage);
    const setLanguage = useUser((state) => state.setLanguage);
    const syncActiveLanguage = useUser(
        (state) => state.syncActiveLanguage,
    );

    const [languages, setLanguages] = useState<LanguageOption[]>([
        fallbackOption,
    ]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const mountedRef = useRef(false);
    const loadVersionRef = useRef(0);
    const menuId = useId();

    const disabledLabel = t('language.pluginDisabled', {
        defaultValue: 'Plugin disabled',
    });

    const loadLanguages = async () => {
        const loadVersion = ++loadVersionRef.current;

        setIsLoading(true);

        try {
            const available = await getAvailableLanguageOptions();

            if (
                !mountedRef.current ||
                loadVersion !== loadVersionRef.current
            ) {
                return;
            }

            setLanguages(available);

            void syncActiveLanguage().catch((error) => {
                console.error(
                    'Failed to synchronize active language:',
                    error,
                );
            });
        } catch (error) {
            console.error('Failed to load language options:', error);

            if (
                mountedRef.current &&
                loadVersion === loadVersionRef.current
            ) {
                setLanguages([fallbackOption]);
            }
        } finally {
            if (
                mountedRef.current &&
                loadVersion === loadVersionRef.current
            ) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        mountedRef.current = true;

        void loadLanguages();

        return () => {
            mountedRef.current = false;
            loadVersionRef.current++;
        };
    }, []);

    const currentLanguage =
        languages.find(
            (item) => item.code === language && item.enabled,
        ) ?? fallbackOption;

    const currentCountry = countryByLanguage[currentLanguage.code];

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    const selectLanguage = (code: string) => {
        if (
            isLoading ||
            !languages.some(
                (item) => item.code === code && item.enabled,
            )
        ) {
            return;
        }

        setIsOpen(false);

        if (code !== useUser.getState().language) {
            setLanguage(code);
        }

        triggerRef.current?.focus();
    };

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                    if (!isOpen) {
                        void loadLanguages();
                    }

                    setIsOpen((previous) => !previous);
                }}
                aria-label={t('Navbar.ProfileDropdown.language', {
                    defaultValue: 'Language',
                })}
                aria-expanded={isOpen}
                aria-controls={isOpen ? menuId : undefined}
                aria-haspopup="true"
                aria-busy={isLoading}
                className={[
                    'flex min-h-10 items-center gap-2.5 rounded-xl',
                    'border border-border-subtle bg-surface/90',
                    'px-3 py-2 text-sm text-text-primary',
                    'shadow-lg shadow-black/10 backdrop-blur-md',
                    'transition-all duration-200',
                    'hover:border-primary/40 hover:bg-surface-elevated',
                    'focus-visible:outline-none focus-visible:ring-2',
                    'focus-visible:ring-primary/50',
                    isOpen ? 'border-primary/50 bg-surface-elevated' : '',
                ].join(' ')}
            >
                <Languages
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-primary"
                />

                {currentCountry && (
                    <span
                        className={`fi fi-${currentCountry} rounded-sm shadow-sm`}
                        aria-hidden="true"
                    />
                )}

                <span className="font-medium">
                    {currentLanguage.name}
                </span>

                <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={[
                        'ml-1 text-text-secondary transition-transform duration-200',
                        isOpen ? 'rotate-180' : '',
                    ].join(' ')}
                />
            </button>

            {isOpen && (
                <div
                    id={menuId}
                    className={[
                        'absolute right-0 top-full z-50 mt-2 w-56',
                        'overflow-hidden rounded-xl',
                        'border border-border-subtle bg-surface',
                        'p-1.5 shadow-2xl shadow-black/30',
                    ].join(' ')}
                >
                    {languages.map((item) => {
                        const isDisabled = !item.enabled;
                        const isSelected =
                            item.enabled && item.code === language;
                        const country = countryByLanguage[item.code];

                        return (
                            <button
                                key={item.code}
                                type="button"
                                onClick={() => selectLanguage(item.code)}
                                aria-pressed={isSelected}
                                aria-label={
                                    isDisabled
                                        ? `${item.name} — ${disabledLabel}`
                                        : item.name
                                }
                                disabled={isLoading || isDisabled}
                                title={isDisabled ? disabledLabel : undefined}
                                className={[
                                    'flex w-full items-center gap-3 rounded-lg',
                                    'px-3 py-2.5 text-left text-sm',
                                    'transition-colors duration-150',
                                    'focus-visible:outline-none',
                                    'focus-visible:ring-2 focus-visible:ring-primary/50',
                                    isDisabled
                                        ? 'cursor-not-allowed opacity-45'
                                        : isLoading
                                            ? 'cursor-wait opacity-60'
                                            : isSelected
                                                ? 'bg-primary/15 font-semibold text-primary'
                                                : 'text-text-secondary hover:bg-white/5 hover:text-text-primary',
                                ].join(' ')}
                            >
                                {country && (
                                    <span
                                        className={`fi fi-${country} rounded-sm shadow-sm`}
                                        aria-hidden="true"
                                    />
                                )}

                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span>{item.name}</span>

                                    {isDisabled && (
                                        <span className="text-xs font-normal text-text-secondary">
                                            {disabledLabel}
                                        </span>
                                    )}
                                </span>

                                {isDisabled ? (
                                    <Lock
                                        size={15}
                                        aria-hidden="true"
                                        className="shrink-0 text-text-secondary"
                                    />
                                ) : isSelected ? (
                                    <Check
                                        size={16}
                                        aria-hidden="true"
                                        className="shrink-0 text-primary"
                                    />
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};