import {
    AlertCircle,
    Clock3,
    LoaderCircle,
    RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useServiceInstallation } from "@/features/services/installation/hooks/useServiceInstallation";

type ServiceInstallationActionsProps = {
    serviceId: string;
    installStatus?: string | null;
};

const jobStatusKeys: Record<string, string> = {
    PENDING: "pending",
    DISPATCHING: "dispatching",
    QUEUED: "queued",
    RUNNING: "running",
};

const clampProgress = (value: number) => {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(100, value));
};

export const ServiceInstallationActions = ({
    serviceId,
    installStatus,
}: ServiceInstallationActionsProps) => {
    const { t } = useTranslation();

    const {
        job,
        activeInstallJob,
        createInstallJob,
        isCheckingJob,
        hasJobLookupError,
        canRequestInstallation,
        requestInstallation,
        retryJobLookup,
    } = useServiceInstallation(serviceId, installStatus);

    const canShowRequestButton =
        installStatus === "DRAFT" ||
        installStatus === "FAILED";

    const isRetry = installStatus === "FAILED";

    const progress = job
        ? clampProgress(job.progress)
        : 0;

    const jobStatusKey = job
        ? jobStatusKeys[job.status]
        : undefined;

    return (
        <section className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-6">
            <div>
                <h3 className="text-lg font-semibold text-text-primary">
                    {t("services.installation.job.title")}
                </h3>

                <p className="mt-1 text-sm text-text-secondary">
                    {t("services.installation.job.description")}
                </p>
            </div>

            {activeInstallJob.isPending ? (
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                    <LoaderCircle
                        size={18}
                        className="animate-spin text-primary"
                        aria-hidden="true"
                    />

                    {t("services.installation.job.loading")}
                </div>
            ) : hasJobLookupError ? (
                <div
                    role="alert"
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle
                            size={18}
                            className="shrink-0 text-rose-400"
                            aria-hidden="true"
                        />

                        <div className="space-y-3">
                            <p className="text-sm leading-6 text-text-secondary">
                                {t(
                                    "services.installation.job.loadError",
                                )}
                            </p>

                            <button
                                type="button"
                                onClick={retryJobLookup}
                                disabled={isCheckingJob}
                                className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <RefreshCw
                                    size={14}
                                    className={
                                        isCheckingJob
                                            ? "animate-spin"
                                            : ""
                                    }
                                    aria-hidden="true"
                                />

                                {t(
                                    "services.installation.actions.checkAgain",
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            ) : job ? (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Clock3
                                size={18}
                                className="text-primary"
                                aria-hidden="true"
                            />

                            <span className="text-sm font-medium text-text-primary">
                                {jobStatusKey
                                    ? t(
                                        `services.installation.job.status.${jobStatusKey}`,
                                    )
                                    : job.status}
                            </span>

                            {activeInstallJob.isFetching && (
                                <LoaderCircle
                                    size={14}
                                    className="animate-spin text-text-secondary"
                                    aria-label={t(
                                        "services.installation.job.loading",
                                    )}
                                />
                            )}
                        </div>

                        <span className="text-sm font-semibold text-primary">
                            {progress}%
                        </span>
                    </div>

                    <div
                        role="progressbar"
                        aria-label={t(
                            "services.installation.job.progress",
                        )}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        className="h-2.5 overflow-hidden rounded-full bg-white/10"
                    >
                        <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                                width: `${progress}%`,
                            }}
                        />
                    </div>

                    <p className="text-xs leading-5 text-text-secondary">
                        {t(
                            "services.installation.job.progressSource",
                        )}
                    </p>
                </div>
            ) : (
                <div className="rounded-xl border border-border-subtle p-4">
                    <p className="text-sm text-text-secondary">
                        {t(
                            "services.installation.job.noActiveJob",
                        )}
                    </p>

                    {activeInstallJob.isFetching && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                            <LoaderCircle
                                size={14}
                                className="animate-spin text-primary"
                                aria-hidden="true"
                            />

                            {t(
                                "services.installation.job.loading",
                            )}
                        </div>
                    )}
                </div>
            )}

            {canShowRequestButton && (
                <div className="flex justify-end border-t border-border-subtle pt-5">
                    <button
                        type="button"
                        disabled={!canRequestInstallation}
                        onClick={requestInstallation}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {createInstallJob.isPending && (
                            <LoaderCircle
                                size={16}
                                className="animate-spin"
                                aria-hidden="true"
                            />
                        )}

                        {createInstallJob.isPending
                            ? t(
                                "services.installation.actions.requesting",
                            )
                            : job || createInstallJob.isSuccess
                                ? t(
                                    "services.installation.actions.alreadyRequested",
                                )
                                : isRetry
                                    ? t(
                                        "services.installation.actions.retry",
                                    )
                                    : t(
                                        "services.installation.actions.start",
                                    )}
                    </button>
                </div>
            )}
        </section>
    );
};
