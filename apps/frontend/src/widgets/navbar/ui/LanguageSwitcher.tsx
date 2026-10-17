import { useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Languages,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useUser } from "@/shared/store/user";

const languages = [
  { code: "pl", label: "Polski", country: "pl" },
  { code: "en", label: "English", country: "gb" },
  { code: "de", label: "Deutsch", country: "de" },
] as const;

export const LanguageSwitcher = () => {
  const { t } = useTranslation();

  const language = useUser((state) => state.language);
  const updateLanguage = useUser((state) => state.updateLanguage);

  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const currentLanguage =
    languages.find((item) => item.code === language) ??
    languages[1];

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
    if (isSaving || code === language) {
      setIsOpen(false);
      return;
    }

    setIsSaving(true);
    setIsOpen(false);
    setHasError(false);

    try {
      await updateLanguage(code);
    } catch {
      setHasError(true);
    } finally {
      setIsSaving(false);
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
          setIsOpen((previous) => !previous);
          setHasError(false);
        }}
        disabled={isSaving}
        aria-expanded={isOpen}
        aria-controls={listId}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-subtle bg-background/60 px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
      >
        <span className="flex items-center gap-3">
          <span
            className={`fi fi-${currentLanguage.country} rounded-sm`}
            aria-hidden="true"
          />
          <span>{currentLanguage.label}</span>
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
            const isSelected = item.code === language;

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
                  <span
                    className={`fi fi-${item.country} rounded-sm`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </span>

                {isSelected && (
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
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
