import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
    AlertTriangle,
    Check,
    Clock3,
    Download,
    LoaderCircle,
    LockKeyhole,
    PackageOpen,
} from "lucide-react";

type InstallationStatus =
    | "DRAFT"
    | "PENDING_INSTALL"
    | "INSTALLING"
    | "FAILED"
    | "INSTALLED";

type ServiceInstallationCenterProps = {
    serviceName: string;
    installStatus?: string | null;
    children?: ReactNode;
};

const steps = [
    {
        key: "preparation",
    },
    {
        key: "queue",
    },
    {
        key: "installation",
    },
    {
        key: "completed",
    },
] as const;

const normalizeStatus = (
    status?: string | null,
): InstallationStatus | "UNKNOWN" => {
    switch (status?.toUpperCase()) {
        case "DRAFT":
        case "PENDING_INSTALL":
        case "INSTALLING":
        case "FAILED":
        case "INSTALLED":
            return status.toUpperCase() as InstallationStatus;

        default:
            return "UNKNOWN";
    }
};

const getCurrentStep = (
    status: InstallationStatus | "UNKNOWN",
) => {
    switch (status) {
        case "DRAFT":
        case "FAILED":
        case "UNKNOWN":
            return 0;

        case "PENDING_INSTALL":
            return 1;

        case "INSTALLING":
            return 2;

        case "INSTALLED":
            return 3;
    }
};

const statusIcons = {
    DRAFT: PackageOpen,
    PENDING_INSTALL: Clock3,
    INSTALLING: Download,
    FAILED: AlertTriangle,
    INSTALLED: Check,
    UNKNOWN: LoaderCircle,
} as const;

const statusTranslationKeys = {
    DRAFT: "draft",
    PENDING_INSTALL: "pending",
    INSTALLING: "installing",
    FAILED: "failed",
    INSTALLED: "installed",
    UNKNOWN: "unknown",
} as const;

export const ServiceInstallationCenter = ({
    serviceName,
    installStatus,
    children,
}: ServiceInstallationCenterProps) => {
    const { t } = useTranslation();

    const status = normalizeStatus(installStatus);
    const currentStep = getCurrentStep(status);

    const StatusIcon = statusIcons[status];
    const statusKey = statusTranslationKeys[status];

    return (
        <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <div className="border-b border-border-subtle bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-primary">
                                <StatusIcon
                                    size={26}
                                    aria-hidden="true"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                                    {t(
                                        "services.installation.title",
                                        {
                                            defaultValue:
                                                "Service Installation Center",
                                        },
                                    )}
                                </p>

                                <h2 className="text-xl font-bold text-text-primary sm:text-2xl">
                                    {t(
                                        `services.installation.status.${statusKey}.title`,
                                    )}
                                </h2>

                                <p className="max-w-xl text-sm leading-6 text-text-secondary">
                                    {t(
                                        `services.installation.status.${statusKey}.description`,
                                    )}
                                </p>
                            </div>
                        </div>

                        <span className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-medium text-text-secondary">
                            <LockKeyhole
                                size={14}
                                aria-hidden="true"
                            />

                            {t(
                                "services.installation.locked.badge",
                            )}
                        </span>
                    </div>

                    <p className="mt-5 break-words text-sm text-text-secondary">
                        {t(
                            "services.installation.serviceLabel",
                        )}
                        :{" "}
                        <span className="font-semibold text-text-primary">
                            {serviceName}
                        </span>
                    </p>
                </div>

                <div className="p-6 sm:p-8">
                    <h3 className="mb-5 text-sm font-semibold text-text-primary">
                        {t(
                            "services.installation.steps.title",
                        )}
                    </h3>

                    <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {steps.map((step, index) => {
                            const completed =
                                index < currentStep;

                            const active =
                                index === currentStep &&
                                status !== "FAILED" &&
                                status !== "UNKNOWN";

                            return (
                                <li
                                    key={step.key}
                                    className={`rounded-xl border p-4 ${active
                                        ? "border-primary/40 bg-primary/10"
                                        : "border-border-subtle bg-surface"
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${completed
                                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                                : active
                                                    ? "border-primary/40 bg-primary/15 text-primary"
                                                    : "border-border-subtle text-text-secondary"
                                                }`}
                                        >
                                            {completed ? (
                                                <Check
                                                    size={17}
                                                    aria-hidden="true"
                                                />
                                            ) : (
                                                index + 1
                                            )}
                                        </span>

                                        <span className="text-sm font-semibold text-text-primary">
                                            {t(
                                                `services.installation.steps.${step.key}.title`,
                                            )}
                                        </span>
                                    </div>

                                    <p className="mt-3 text-xs leading-5 text-text-secondary">
                                        {t(
                                            `services.installation.steps.${step.key}.description`,
                                        )}
                                    </p>

                                    {active && (
                                        <span className="mt-3 inline-flex rounded-md bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                            {t(
                                                "services.installation.steps.current",
                                            )}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ol>

                    {status === "FAILED" && (
                        <div
                            role="alert"
                            className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
                        >
                            <AlertTriangle
                                size={18}
                                className="shrink-0 text-rose-400"
                                aria-hidden="true"
                            />

                            <p className="text-sm leading-6 text-text-secondary">
                                {t(
                                    "services.installation.errors.installationFailed",
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {children}

            <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface p-4">
                <LockKeyhole
                    size={18}
                    className="mt-0.5 shrink-0 text-primary"
                    aria-hidden="true"
                />

                <div className="space-y-1">
                    <p className="text-sm font-semibold text-text-primary">
                        {t(
                            "services.installation.locked.title",
                        )}
                    </p>

                    <p className="text-xs leading-6 text-text-secondary">
                        {t(
                            "services.installation.locked.description",
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
};