
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ServiceFeedback } from "@/features/services/components/ServiceFeedback";
import { ServiceOverview } from "@/features/services/components/ServiceOverview";
import { ServiceNavigation, getServerSectionIcon, getServerSectionTranslationKey, type ServerSection } from "@/features/services/components/ServiceNavigation";
import { useServerDetails } from "@/features/servers/hooks/useServerDetails";
import { ServerConsole } from "@/features/servers/components/ServerConsole";
import { ServerFilesPanel } from "@/features/servers/components/ServerFilesPanel";
import {
  ServerUploadWidget,
  type UploadTransfer,
} from "@/features/servers/components/ServerUploadWidget";

export const ServerDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const [activeSection, setActiveSection] =
    useState<ServerSection>("console");
  const [uploadTransfers, setUploadTransfers] =
    useState<UploadTransfer[]>([]);
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const [dismissedTransferIds, setDismissedTransferIds] =
    useState<string[]>([]);

  const isDemoMode = searchParams.get("demo") === "1";

  const {
    server,
    previewServer,
    isValidServerId,
    isNotFound,
    showError,
    showLoading,
    isFetching,
    refetch,
  } = useServerDetails(id, isDemoMode);

  const d = (key: string) => t(`dashboard.serverDetails.${key}`);

  const ActiveSectionIcon = getServerSectionIcon(activeSection);
  const activeSectionLabel = t(getServerSectionTranslationKey(activeSection));

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

      {showError ? (
        <ServiceFeedback
          kind={isNotFound ? "empty" : "error"}
          title={
            isNotFound
              ? t("dashboard.servers.notFoundTitle", { defaultValue: "Server not found" })
              : t("dashboard.servers.detailsErrorTitle", { defaultValue: "Unable to load server details" })
          }
          description={
            isNotFound
              ? t("dashboard.servers.notFoundDescription", {
                defaultValue: "This server does not exist or you do not have access to it.",
              })
              : t("dashboard.servers.detailsErrorDescription", {
                defaultValue: "Server details could not be loaded. Please try again.",
              })
          }
          retryLabel={t("dashboard.servers.retry", { defaultValue: "Try again" })}
          onRetry={!isDemoMode && isValidServerId && !isNotFound ? () => void refetch() : undefined}
          retrying={isFetching}
        />
      ) : showLoading ? (
        <ServiceFeedback
          kind="loading"
          loadingLabel={t("dashboard.servers.loadingDetails", {
            defaultValue: "Loading server details...",
          })}
        />
      ) : server ? (
        <>
          <ServiceOverview
            kind="server"
            id={server.id}
            name={server.name}
            status={server.status}
            isDemoMode={isDemoMode}
            preview={previewServer}
          />

          <ServiceNavigation
            kind="server"
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />

          {activeSection === "files" ? (
            <ServerFilesPanel
              isDemoMode={isDemoMode}
              onOpenUploads={() => setUploadsOpen(true)}
              onTransfersChange={(transfers) =>
                setUploadTransfers(transfers)
              }
            />
          ) : activeSection === "console" ? (
            <ServerConsole
              isDemoMode={isDemoMode}
              previewServer={previewServer}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-border-subtle bg-surface p-8 text-center sm:p-12">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ActiveSectionIcon size={26} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-text-primary">
                {activeSectionLabel}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
                {d("plannedSection")}
              </p>
            </section>
          )}
        </>
      ) : null}

      {server && !showError && (
        <ServerUploadWidget
          transfers={uploadTransfers.filter(
            (transfer) =>
              !dismissedTransferIds.includes(transfer.id),
          )}
          open={uploadsOpen}
          onClose={() => setUploadsOpen(false)}
          onRemoveTransfer={(id) =>
            setDismissedTransferIds((previous) => [
              ...previous,
              id,
            ])
          }
          onClearFinished={() =>
            setDismissedTransferIds((previous) =>
              Array.from(
                new Set([
                  ...previous,
                  ...uploadTransfers
                    .filter(
                      (transfer) =>
                        transfer.state === "complete" ||
                        transfer.state === "error",
                    )
                    .map((transfer) => transfer.id),
                ]),
              ),
            )
          }
        />
      )}
    </div>
  );
};
