import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";

export const ServiceNavigation = () => {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("dashboard.services.title")}
      className="flex gap-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-2"
    >
      <span
        aria-current="page"
        className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-3 py-2.5 text-sm font-medium text-primary"
      >
        <Layers size={16} aria-hidden="true" />
        {t("dashboard.services.title")}
      </span>
    </nav>
  );
};
