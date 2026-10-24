
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { useServiceDetails } from "@/features/services/hooks/useServiceDetails";
import { useActiveServiceInstallJob } from "@/features/services/hooks/useActiveServiceInstallJob";
import { useCreateServiceInstallJob } from "@/features/services/hooks/useCreateServiceInstallJob";
import { ServiceFeedback } from "@/features/services/components/ServiceFeedback";
import { ServiceOverview } from "@/features/services/components/ServiceOverview";
import { ServiceStatus } from "@/features/services/components/ServiceStatus";
import { ServiceNavigation } from "@/features/services/components/ServiceNavigation";

const installJobLabels: Record<string, string> = {
    PENDING: "Waiting for installation",
    DISPATCHING: "Preparing installation",
    QUEUED: "Queued for installation",
    RUNNING: "Installation in progress",
};

export const ServiceDetailsPage = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();

    const {
        service,
        showLoading,
        showError,
        isNotFound,
        isFetching,
        refetch,
    } = useServiceDetails(id);

    const activeInstallJob = useActiveServiceInstallJob(
        service ? service.id : undefined,
    );

    const createInstallJob = useCreateServiceInstallJob(
        service ? service.id : undefined,
    );

    const job = activeInstallJob.data;

    const linkedServerId = service
        ? (service.server?.id ?? service.serverId)
        : null;

    const canRequestInstallation =
        service != null &&
        (service.installStatus === "DRAFT" ||
            service.installStatus === "FAILED") &&
        !activeInstallJob.isPending &&
        !activeInstallJob.isError &&
        !job &&
        !createInstallJob.isPending;

    return (
        <div className="space-y-5">
            <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
                <ArrowLeft size={16} aria-hidden="true" />
                {t("dashboard.servers.backToDashboard", {
                    defaultValue: "Back to dashboard",
                })}
            </Link>

            {isNotFound ? (
                <ServiceFeedback
                    kind="empty"
                    title={t("dashboard.services.notFoundTitle", {
                        defaultValue: "Service not found",
                    })}
                    description={t("dashboard.services.notFoundDescription", {
                        defaultValue: "This service does not exist or you do not have access to it.",
                    })}
                />
            ) : showError ? (
                <ServiceFeedback
                    kind="error"
                    title={t("dashboard.services.errorTitle")}
                    retryLabel={t("dashboard.servers.retry")}
                    onRetry={() => void refetch()}
                    retrying={isFetching}
                />
            ) : showLoading ? (
                <ServiceFeedback
                    kind="loading"
                    loadingLabel={t("dashboard.services.loading")}
                />
            ) : !service ? (
                <ServiceFeedback
                    kind="empty"
                    title={t("dashboard.services.notFoundTitle", {
                        defaultValue: "Service not found",
                    })}
                    description={t("dashboard.services.notFoundDescription", {
                        defaultValue: "This service does not exist or you do not have access to it.",
                    })}
                />
            ) : (
                <>
                    <ServiceOverview
                        kind="service"
                        name={service.name}
                        id={service.id}
                        category={service.category?.name}
                    />

                    <ServiceNavigation kind="service" />

                    <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                        <h2 className="text-lg font-semibold text-text-primary">
                            {t("dashboard.services.title")}
                        </h2>

                        <dl className="mt-4 divide-y divide-border-subtle text-sm">
                            <div className="flex flex-wrap justify-between gap-3 py-3">
                                <dt className="text-text-secondary">
                                    {t("dashboard.services.categoryLabel")}
                                </dt>
                                <dd className="text-text-primary">
                                    {service.category?.name}
                                </dd>
                            </div>

                            <div className="flex flex-wrap justify-between gap-3 py-3">
                                <dt className="text-text-secondary">
                                    {t("dashboard.services.pendingInstallation")}
                                </dt>
                                <dd className="text-text-primary">
                                    <ServiceStatus
                                        kind="installation"
                                        status={service.installStatus}
                                    />
                                </dd>
                            </div>

                            <div className="flex flex-wrap justify-between gap-3 py-3">
                                <dt className="text-text-secondary">
                                    Installation job
                                </dt>

                                <dd className="text-right text-text-primary">
                                    {activeInstallJob.isPending ? (
                                        <span className="text-text-secondary">
                                            Loading...
                                        </span>
                                    ) : activeInstallJob.isError ? (
                                        <span className="text-rose-400">
                                            Unable to load installation job
                                        </span>
                                    ) : job ? (
                                        <div className="space-y-1">
                                            <div className="font-medium text-amber-400">
                                                {installJobLabels[job.status] ?? job.status}
                                            </div>

                                            <div className="text-xs text-text-secondary">
                                                Progress: {job.progress}%
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-text-secondary">
                                            No active installation job
                                        </span>
                                    )}
                                </dd>
                            </div>

                            {(service.installStatus === "DRAFT" ||
                                service.installStatus === "FAILED") && (
                                    <div className="flex justify-end py-4">
                                        <button
                                            type="button"
                                            disabled={!canRequestInstallation}
                                            onClick={() => createInstallJob.mutate()}
                                            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {createInstallJob.isPending
                                                ? "Requesting installation..."
                                                : job
                                                    ? "Installation already requested"
                                                    : "Request installation"}
                                        </button>
                                    </div>
                                )}

                            {service.server?.status != null && (
                                <div className="flex flex-wrap justify-between gap-3 py-3">
                                    <dt className="text-text-secondary">
                                        {t("dashboard.services.runtimeStatusLabel", {
                                            defaultValue: "Runtime",
                                        })}
                                    </dt>
                                    <dd className="text-text-primary">
                                        <ServiceStatus
                                            kind="runtime"
                                            status={service.server.status}
                                        />
                                    </dd>
                                </div>
                            )}

                            <div className="flex flex-wrap justify-between gap-3 py-3">
                                <dt className="text-text-secondary">
                                    {t("dashboard.services.linkedServer")}
                                </dt>
                                <dd className="text-text-primary">
                                    {linkedServerId !== null ? (
                                        <Link
                                            className="text-primary hover:underline"
                                            to={`/servers/${linkedServerId}`}
                                        >
                                            #{linkedServerId}
                                        </Link>
                                    ) : (
                                        t("dashboard.services.detailsUnavailable")
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </section>
                </>
            )}
        </div>
    );
};
