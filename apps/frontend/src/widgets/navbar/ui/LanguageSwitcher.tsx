import { useState, useRef, useEffect } from "react";
import { useUser } from "@/shared/store/user";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

const languages = [
  { code: "en", label: "English", country: "gb" },
  { code: "pl", label: "Polski", country: "pl" },
  { code: "de", label: "Deutsch", country: "de" },
];

export const LanguageSwitcher = () => {
  const { language, updateLanguage } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { t } = useTranslation();

  const currentLang = languages.find((l) => l.code === language);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative mb-3">
      <div className="text-xs text-gray-400 mb-1">{t("Navbar.ProfileDropdown.language")}</div>

      {/* Trigger */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-3 py-2 bg-[#1f2a3a] rounded-lg hover:bg-[#2c3a4d]"
      >
        <div className="flex items-center gap-2">
          <span className={`fi fi-${currentLang?.country} w-5 h-4`}></span>
          <span>{currentLang?.label}</span>
        </div>
        <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▲
        </span>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-full bg-[#1f2a3a] rounded-lg shadow-lg overflow-hidden z-50"
          >
            {languages.map((lang) => (
              <div
                key={lang.code}
                onClick={() => {
                  updateLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-[#2c3a4d] ${language === lang.code ? "bg-[#2c3a4d]" : ""
                  }`}
              >
                <span className={`fi fi-${lang.country} w-5 h-4`}></span>
                <span>{lang.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};