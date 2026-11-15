import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { ServiceFeedback } from "@/features/services/components/ServiceFeedback";
import { ServiceStatus } from "@/features/services/components/ServiceStatus";
import { useServiceDetails } from "@/features/services/hooks/useServiceDetails";
import { ServiceInstallationActions } from "@/features/services/installation/components/ServiceInstallationActions";
import { ServiceWorkspace } from "@/features/services/workspace/ServiceWorkspace";

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

    return (
        <div className="space-y-5">
            <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
            >
                <ArrowLeft size={16} aria-hidden="true" />

                {t("dashboard.services.backToDashboard", {
                    defaultValue: "Back to dashboard",
                })}
            </Link>

            {isNotFound ? (
                <ServiceFeedback
                    kind="empty"
                    title={t("dashboard.services.notFoundTitle", {
                        defaultValue: "Service not found",
                    })}
                    description={t(
                        "dashboard.services.notFoundDescription",
                        {
                            defaultValue:
                                "This service does not exist or you do not have access to it.",
                        },
                    )}
                />
            ) : showError ? (
                <ServiceFeedback
                    kind="error"
                    title={t("dashboard.services.errorTitle")}
                    retryLabel={t("dashboard.services.retry")}
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
                    description={t(
                        "dashboard.services.notFoundDescription",
                        {
                            defaultValue:
                                "This service does not exist or you do not have access to it.",
                        },
                    )}
                />
            ) : (
                <ServiceWorkspace
                    key={service.id}
                    service={service}
                    overview={
                        service.installStatus === "INSTALLED" ? (
                            <section className="rounded-2xl border border-border-subtle bg-surface p-6">
                                <h2 className="text-lg font-semibold text-text-primary">
                                    {t(
                                        "services.details.informationTitle",
                                    )}
                                </h2>

                                <dl className="mt-4 divide-y divide-border-subtle text-sm">
                                    <div className="flex flex-wrap justify-between gap-3 py-3">
                                        <dt className="text-text-secondary">
                                            {t(
                                                "dashboard.services.categoryLabel",
                                            )}
                                        </dt>

                                        <dd className="text-text-primary">
                                            {service.category?.name ??
                                                t(
                                                    "dashboard.services.detailsUnavailable",
                                                )}
                                        </dd>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                                        <dt className="text-text-secondary">
                                            {t(
                                                "services.details.installationStatusLabel",
                                            )}
                                        </dt>

                                        <dd>
                                            <ServiceStatus
                                                kind="installation"
                                                status={service.installStatus}
                                            />
                                        </dd>
                                    </div>

                                    {service.server?.status != null && (
                                        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                                            <dt className="text-text-secondary">
                                                {t(
                                                    "dashboard.services.runtimeStatusLabel",
                                                    {
                                                        defaultValue:
                                                            "Runtime",
                                                    },
                                                )}
                                            </dt>

                                            <dd>
                                                <ServiceStatus
                                                    kind="runtime"
                                                    status={
                                                        service.server.status
                                                    }
                                                />
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </section>
                        ) : (
                            <ServiceInstallationActions
                                serviceId={service.id}
                                installStatus={service.installStatus}
                            />
                        )
                    }
                />
            )}
        </div>
    );
};
