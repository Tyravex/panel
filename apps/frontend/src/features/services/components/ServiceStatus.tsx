import { useTranslation } from "react-i18next";

type ServiceStatusProps =
    | { kind: "installation"; status?: string | null }
    | { kind: "runtime"; status?: string | null };

const runtimeStyles: Record<string, string> = {
    online: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
    offline: "border-rose-500/40 bg-rose-500/15 text-rose-400",
    maintenance: "border-amber-500/40 bg-amber-500/15 text-amber-400",
};

const installationStyles: Record<string, string> = {
    INSTALLED: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
    FAILED: "border-rose-500/40 bg-rose-500/15 text-rose-400",
    INSTALLING: "border-blue-500/40 bg-blue-500/15 text-blue-300",
    PENDING_INSTALL: "border-amber-500/40 bg-amber-500/15 text-amber-400",
    DRAFT: "border-slate-500/40 bg-slate-500/15 text-slate-300",
};

export const ServiceStatus = ({ kind, status }: ServiceStatusProps) => {
    const { t } = useTranslation();
    const normalized = kind === "runtime" ? status?.toLowerCase() : status?.toUpperCase();
    const classes =
        (kind === "runtime" ? runtimeStyles : installationStyles)[normalized ?? ""] ??
        "border-slate-500/40 bg-slate-500/15 text-slate-300";

    const label = (() => {
        if (kind === "installation") {
            return normalized === "DRAFT"
                ? t("dashboard.services.draft")
                : status || "—";
        }
        switch (normalized) {
            case "online": return t("dashboard.serviceDetails.statusOnline");
            case "offline": return t("dashboard.serviceDetails.statusOffline");
            case "maintenance": return t("dashboard.serviceDetails.statusMaintenance");
            default: return status || t("dashboard.serviceDetails.statusUnknown");
        }
    })();

    const typeLabel = kind === "installation"
        ? t("dashboard.services.installationStatusLabel", { defaultValue: "Installation" })
        : t("dashboard.services.runtimeStatusLabel", { defaultValue: "Runtime" });

    return (
        <span className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${classes}`}>
            <span className="opacity-75">{typeLabel}:</span>
            <span className="break-words">{label}</span>
        </span>
    );
};
