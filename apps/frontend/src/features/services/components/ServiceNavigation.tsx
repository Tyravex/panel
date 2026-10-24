import {
    CalendarClock,
    Database,
    FileText,
    HardDrive,
    Layers,
    Rocket,
    Settings2,
    Terminal,
    Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export type ServerSection =
    | "console"
    | "files"
    | "databases"
    | "schedules"
    | "backups"
    | "users"
    | "startup"
    | "settings";

const serverTabs = [
    { id: "console", key: "console", icon: Terminal },
    { id: "files", key: "files", icon: FileText },
    { id: "databases", key: "databases", icon: Database },
    { id: "schedules", key: "schedules", icon: CalendarClock },
    { id: "backups", key: "backups", icon: HardDrive },
    { id: "users", key: "users", icon: Users },
    { id: "startup", key: "startup", icon: Rocket },
    { id: "settings", key: "settings", icon: Settings2 },
] as const;

export const getServerSectionIcon = (section: ServerSection) =>
    serverTabs.find((tab) => tab.id === section)?.icon ?? Terminal;

export const getServerSectionTranslationKey = (section: ServerSection) =>
    `dashboard.servers.${section}`;

type ServiceNavigationProps =
    | {
        kind: "server";
        activeSection: ServerSection;
        onSectionChange: (section: ServerSection) => void;
    }
    | { kind: "service" };

export const ServiceNavigation = (props: ServiceNavigationProps) => {
    const { t } = useTranslation();

    if (props.kind === "service") {
        return (
            <nav aria-label={t("dashboard.services.title")} className="flex gap-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-2">
                <span aria-current="page" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-3 py-2.5 text-sm font-medium text-primary">
                    <Layers size={16} aria-hidden="true" />
                    {t("dashboard.services.title")}
                </span>
            </nav>
        );
    }

    return (
        <nav aria-label={t("dashboard.serverDetails.serverNavigation")} className="flex gap-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-2">
            {serverTabs.map((tab) => {
                const Icon = tab.icon;
                const active = props.activeSection === tab.id;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => props.onSectionChange(tab.id)}
                        aria-current={active ? "page" : undefined}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active
                            ? "border border-primary/40 bg-primary/15 text-primary"
                            : "border border-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary"
                            }`}
                    >
                        <Icon size={16} aria-hidden="true" />
                        {t(`dashboard.servers.${tab.key}`)}
                    </button>
                );
            })}
        </nav>
    );
};
