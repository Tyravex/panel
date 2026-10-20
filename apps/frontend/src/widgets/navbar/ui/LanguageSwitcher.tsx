import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Languages,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Language } from "@/features/auth/api/getLanguages";
import {
  fallbackLanguage,
  getAvailableLanguages,
} from "@/shared/i18n/availableLanguages";
import { useUser } from "@/shared/store/user";

const countryByLanguage: Record<string, string> = {
  en: "gb",
  pl: "pl",
  de: "de",
};

export const LanguageSwitcher = () => {
  const { t } = useTranslation();

  const language = useUser((state) => state.activeLanguage);
  const updateLanguage = useUser((state) => state.updateLanguage);

  const [languages, setLanguages] = useState<Language[]>([
    fallbackLanguage,
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const loadVersionRef = useRef(0);
  const listId = useId();

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      loadVersionRef.current++;
    };
  }, []);

  const loadLanguages = async () => {
    const loadVersion = ++loadVersionRef.current;

    try {
      const available = await getAvailableLanguages();

      if (
        !mountedRef.current ||
        loadVersion !== loadVersionRef.current
      ) {
        return;
      }

      setLanguages(available);
      setHasLoadError(false);
    } catch {
      if (
        !mountedRef.current ||
        loadVersion !== loadVersionRef.current
      ) {
        return;
      }

      setLanguages([fallbackLanguage]);
      setHasLoadError(true);
    }
  };

  useEffect(() => {
    void loadLanguages();
  }, []);

  const currentLanguage =
    languages.find((item) => item.code === language) ??
    fallbackLanguage;

  const currentCountry =
    countryByLanguage[currentLanguage.code];

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
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectLanguage = async (code: string) => {
    if (savingRef.current) {
      return;
    }

    if (
      code === language ||
      !languages.some((item) => item.code === code)
    ) {
      setIsOpen(false);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setIsOpen(false);
    setHasError(false);

    try {
      await updateLanguage(code);

      if (mountedRef.current) {
        triggerRef.current?.focus();
      }
    } catch {
      if (mountedRef.current) {
        setHasError(true);
      }
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <p className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-text-secondary">
        <Languages size={14} aria-hidden="true" />
        {t("Navbar.ProfileDropdown.language", {
          defaultValue: "Language",
        })}
      </p>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (savingRef.current) return;

          if (!isOpen) {
            void loadLanguages();
          }

          setIsOpen((previous) => !previous);
          setHasError(false);
          setHasLoadError(false);
        }}
        disabled={isSaving}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-background/60 px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
      >
        <span className="flex items-center gap-3">
          {currentCountry && (
            <span
              className={`fi fi-${currentCountry} rounded-sm`}
              aria-hidden="true"
            />
          )}
          <span>{currentLanguage.name}</span>
        </span>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className={[
            "text-text-secondary transition-transform",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {isOpen && (
        <div
          id={listId}
          className="mt-2 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-lg"
        >
          {languages.map((item) => {
            const isSelected =
              item.code === currentLanguage.code;

            const country = countryByLanguage[item.code];

            return (
              <button
                key={item.code}
                type="button"
                onClick={() => void selectLanguage(item.code)}
                aria-pressed={isSelected}
                disabled={isSaving}
                className={[
                  "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-60",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary",
                ].join(" ")}
              >
                <span className="flex items-center gap-3">
                  {country && (
                    <span
                      className={`fi fi-${country} rounded-sm`}
                      aria-hidden="true"
                    />
                  )}
                  <span>{item.name}</span>
                </span>

                {isSelected && (
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {hasLoadError && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            {t("language.loadError", {
              defaultValue:
                "Could not load available languages. Please try again.",
            })}
          </span>
        </p>
      )}

      {hasError && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            {t("language.saveError", {
              defaultValue:
                "Could not save the language preference. Please try again.",
            })}
          </span>
        </p>
      )}
    </div>
  );
};
