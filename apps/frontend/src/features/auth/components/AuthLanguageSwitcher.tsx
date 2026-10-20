import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Language } from '@/features/auth/api/getLanguages';
import {
    fallbackLanguage,
    getAvailableLanguages,
} from '@/shared/i18n/availableLanguages';
import { useUser } from '@/shared/store/user';

const countryByLanguage: Record<string, string> = {
    en: 'gb',
    pl: 'pl',
    de: 'de',
};

export const AuthLanguageSwitcher = () => {
    const { t } = useTranslation();

    const language = useUser((state) => state.activeLanguage);
    const setLanguage = useUser((state) => state.setLanguage);

    const [languages, setLanguages] = useState<Language[]>([
        fallbackLanguage,
    ]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const mountedRef = useRef(false);
    const loadVersionRef = useRef(0);
    const menuId = useId();

    const loadLanguages = async () => {
        const loadVersion = ++loadVersionRef.current;

        setIsLoading(true);

        try {
            const available = await getAvailableLanguages();

            if (
                mountedRef.current &&
                loadVersion === loadVersionRef.current
            ) {
                setLanguages(available);
            }
        } catch (error) {
            console.error('Failed to load available languages:', error);

            if (
                mountedRef.current &&
                loadVersion === loadVersionRef.current
            ) {
                setLanguages([fallbackLanguage]);
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
        languages.find((item) => item.code === language) ??
        fallbackLanguage;

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
            !languages.some((item) => item.code === code)
        ) {
            return;
        }

        setIsOpen(false);

        if (code !== useUser.getState().language) {
            // setLanguage already starts synchronization.
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
                        'absolute right-0 top-full z-50 mt-2 w-44',
                        'overflow-hidden rounded-xl',
                        'border border-border-subtle bg-surface',
                        'p-1.5 shadow-2xl shadow-black/30',
                    ].join(' ')}
                >
                    {languages.map((item) => {
                        const isSelected = item.code === language;
                        const country = countryByLanguage[item.code];

                        return (
                            <button
                                key={item.code}
                                type="button"
                                onClick={() => selectLanguage(item.code)}
                                aria-pressed={isSelected}
                                disabled={isLoading}
                                className={[
                                    'flex w-full items-center gap-3 rounded-lg',
                                    'px-3 py-2.5 text-left text-sm',
                                    'transition-colors duration-150',
                                    'focus-visible:outline-none',
                                    'focus-visible:ring-2 focus-visible:ring-primary/50',
                                    'disabled:cursor-wait disabled:opacity-60',
                                    isSelected
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

                                <span className="flex-1">
                                    {item.name}
                                </span>

                                {isSelected && (
                                    <Check
                                        size={16}
                                        aria-hidden="true"
                                        className="text-primary"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
