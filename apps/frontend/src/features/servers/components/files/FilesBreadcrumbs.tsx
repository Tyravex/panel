import { ArrowUp, ChevronRight, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getParent } from "../../utils/files/paths";

type Props = {
  directory: string;
  onNavigate: (path: string) => void;
};

export const FilesBreadcrumbs = ({ directory, onNavigate }: Props) => {
  const { t } = useTranslation();
  const segments = directory.split("/").filter(Boolean);

  return (
    <nav aria-label={t("servers.files.labels.breadcrumbs", { defaultValue: "File path" })} className="flex items-center gap-1 overflow-x-auto border-b border-border-subtle px-4 py-3 text-sm text-text-secondary">
      <button type="button" onClick={() => onNavigate(getParent(directory))} disabled={directory === "/"}
        aria-label={t("servers.files.actions.goToParent", { defaultValue: "Go to parent directory" })}
        title={t("servers.files.actions.goToParent", { defaultValue: "Go to parent directory" })}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-text-primary transition-colors hover:bg-white/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
        <ArrowUp size={16} aria-hidden="true" />
        <span>{t("servers.files.actions.up", { defaultValue: "Up" })}</span>
      </button>
      <button type="button" onClick={() => onNavigate("/")}
        aria-label={t("servers.files.actions.goToRoot", { defaultValue: "Go to root directory" })}
        title={t("servers.files.actions.goToRoot", { defaultValue: "Root directory (/)" })}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-text-primary transition-colors hover:bg-white/5 hover:text-primary">
        <Home size={16} aria-hidden="true" /><span>/</span>
      </button>
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`} className="inline-flex items-center gap-1">
          <ChevronRight size={14} aria-hidden="true" />
          <button type="button" onClick={() => onNavigate(`/${segments.slice(0, index + 1).join("/")}`)} className="whitespace-nowrap hover:text-primary">{segment}</button>
        </span>
      ))}
      {segments.length === 0 && <span>/</span>}
    </nav>
  );
};
