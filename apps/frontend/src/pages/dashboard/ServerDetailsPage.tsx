import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import {
  AlertCircle, ArrowLeft, CalendarClock, Database, FileText, HardDrive,
  Info, Play, RefreshCw, Rocket, RotateCcw, Send, Skull, Square,
  Terminal, Users, Wifi, Settings2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { getUserServer } from "@/features/servers/api/servers.api";
import { ServerFilesPanel } from "@/features/servers/components/ServerFilesPanel";
import { ServerUploadWidget, type UploadTransfer } from "@/features/servers/components/ServerUploadWidget";
import { previewServers } from "@/features/servers/mock/servers.mock";

type ServerSection = "console" | "files" | "databases" | "schedules" | "backups" | "users" | "startup" | "settings";

const getStatusStyles = (status: string | null | undefined, t: (key: string) => string) => {
  switch (status?.toLowerCase()) {
    case "online":
      return { label: t("dashboard.serverDetails.statusOnline"), badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" };
    case "offline":
      return { label: t("dashboard.serverDetails.statusOffline"), badge: "border-rose-500/40 bg-rose-500/15 text-rose-400", dot: "bg-rose-400" };
    case "maintenance":
      return { label: t("dashboard.serverDetails.statusMaintenance"), badge: "border-amber-500/40 bg-amber-500/15 text-amber-400", dot: "bg-amber-400" };
    default:
      return { label: status || t("dashboard.serverDetails.statusUnknown"), badge: "border-slate-500/40 bg-slate-500/15 text-slate-300", dot: "bg-slate-400" };
  }
};

const resourceItems = [
  { key: "cpu", color: "text-emerald-400" },
  { key: "memory", color: "text-blue-400" },
  { key: "disk", color: "text-purple-400" },
] as const;

export const ServerDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState<ServerSection>("console");
  const [uploadTransfers, setUploadTransfers] = useState<UploadTransfer[]>([]);
  const [uploadsOpen, setUploadsOpen] = useState(false);
  const [dismissedTransferIds, setDismissedTransferIds] = useState<string[]>([]);

  const serverId = id ? Number(id) : NaN;
  const isValidServerId = Number.isSafeInteger(serverId) && serverId > 0;
  // Demo mode is explicit and never replaces real API data.
  const isDemoMode = searchParams.get("demo") === "1";
  const previewServer = isDemoMode && isValidServerId
    ? previewServers.find((item) => item.id === serverId)
    : undefined;

  const { data: realServer, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["server", serverId],
    queryFn: () => getUserServer(serverId),
    enabled: isValidServerId && !isDemoMode,
    retry: 1,
    staleTime: 30_000,
  });

  const server = isDemoMode ? previewServer : realServer;
  const isNotFound = !isValidServerId || (isDemoMode && !previewServer) ||
    (!isDemoMode && error instanceof AxiosError && (error.response?.status === 404 || error.response?.status === 403));
  const showError = !isValidServerId || (isDemoMode && !previewServer) || (!isDemoMode && isError);
  const showLoading = !isDemoMode && isPending;
  const status = getStatusStyles(server?.status, t);
  const d = (key: string) => t(`dashboard.serverDetails.${key}`);

  const sections = [
    { id: "console" as const, label: t("dashboard.servers.console", { defaultValue: "Console" }), icon: Terminal },
    { id: "files" as const, label: t("dashboard.servers.files", { defaultValue: "Files" }), icon: FileText },
    { id: "databases" as const, label: t("dashboard.servers.databases", { defaultValue: "Databases" }), icon: Database },
    { id: "schedules" as const, label: t("dashboard.servers.schedules", { defaultValue: "Schedules" }), icon: CalendarClock },
    { id: "backups" as const, label: t("dashboard.servers.backups", { defaultValue: "Backups" }), icon: HardDrive },
    { id: "users" as const, label: t("dashboard.servers.users", { defaultValue: "Users" }), icon: Users },
    { id: "startup" as const, label: t("dashboard.servers.startup", { defaultValue: "Startup" }), icon: Rocket },
    { id: "settings" as const, label: t("dashboard.servers.settings", { defaultValue: "Settings" }), icon: Settings2 },
  ];
  const activeSectionConfig = sections.find((section) => section.id === activeSection);
  const ActiveSectionIcon = activeSectionConfig?.icon ?? Terminal;

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary">
        <ArrowLeft size={16} aria-hidden="true" />
        {t("dashboard.servers.backToDashboard", { defaultValue: "Back to dashboard" })}
      </Link>

      {showError ? (
        <section role="alert" className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8">
          <AlertCircle size={28} aria-hidden="true" className="text-red-400" />
          <h1 className="mt-4 text-xl font-semibold text-text-primary">
            {isNotFound
              ? t("dashboard.servers.notFoundTitle", { defaultValue: "Server not found" })
              : t("dashboard.servers.detailsErrorTitle", { defaultValue: "Unable to load server details" })}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {isNotFound
              ? t("dashboard.servers.notFoundDescription", { defaultValue: "This server does not exist or you do not have access to it." })
              : t("dashboard.servers.detailsErrorDescription", { defaultValue: "Server details could not be loaded. Please try again." })}
          </p>
          {!isDemoMode && isValidServerId && !isNotFound && (
            <button type="button" onClick={() => void refetch()} disabled={isFetching}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              <RefreshCw size={16} aria-hidden="true" className={isFetching ? "animate-spin" : ""} />
              {t("dashboard.servers.retry", { defaultValue: "Try again" })}
            </button>
          )}
        </section>
      ) : showLoading ? (
        <section role="status" className="h-56 animate-pulse rounded-3xl border border-border-subtle bg-surface">
          <span className="sr-only">{t("dashboard.servers.loadingDetails", { defaultValue: "Loading server details..." })}</span>
        </section>
      ) : server ? (
        <>
          <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
            <div className="relative min-h-56 bg-slate-950">
              {previewServer ? (
                <img src={previewServer.image} alt={previewServer.game} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-slate-900 to-slate-950" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
              <div className="relative flex min-h-56 flex-col justify-end gap-5 p-5 sm:p-7">
                <div>
                  {isDemoMode && (
                    <span className="mb-3 inline-flex rounded-full border border-primary/40 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-primary">
                      {d("demoBadge")}
                    </span>
                  )}
                  <h1 className="break-words text-2xl font-bold text-white sm:text-3xl">{server.name}</h1>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${status.badge}`}>
                      <span className={`size-2 rounded-full ${status.dot}`} aria-hidden="true" />
                      {status.label}
                    </span>
                    {previewServer && (
                      <>
                        <span className="rounded-lg border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white">{previewServer.version}</span>
                        <span className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white">
                          <Users size={14} aria-hidden="true" />
                          {previewServer.players} / {previewServer.maxPlayers}
                        </span>
                      </>
                    )}
                    <span className="rounded-lg border border-white/15 bg-slate-950/75 px-3 py-2 text-xs text-white">ID: {server.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled title={d("powerUnavailable")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white opacity-50">
                      <Play size={15} aria-hidden="true" />{d("start")}
                    </button>
                    <button type="button" disabled title={d("powerUnavailable")}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white opacity-50">
                      <RotateCcw size={15} aria-hidden="true" />{d("restart")}
                    </button>
                    <button type="button" disabled title={d("powerUnavailable")}
                      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white opacity-50">
                      <Square size={14} aria-hidden="true" />{d("stop")}
                    </button>
                    <button type="button" disabled title={d("forceStopUnavailable")}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950 px-4 py-2 text-sm font-semibold text-rose-300 opacity-50">
                      <Skull size={15} aria-hidden="true" />{d("kill")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <nav aria-label={d("serverNavigation")} className="flex gap-2 overflow-x-auto rounded-2xl border border-border-subtle bg-surface p-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button key={section.id} type="button" onClick={() => setActiveSection(section.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                    ? "border border-primary/40 bg-primary/15 text-primary"
                    : "border border-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary"}`}>
                  <Icon size={16} aria-hidden="true" />{section.label}
                </button>
              );
            })}
          </nav>

          {activeSection === "files" ? (
            <ServerFilesPanel isDemoMode={isDemoMode} onOpenUploads={() => setUploadsOpen(true)}
              onTransfersChange={(transfers) => setUploadTransfers(transfers)} />
          ) : activeSection === "console" ? (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
              <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Terminal size={17} className="text-primary" aria-hidden="true" />{d("console")}
                  </h2>
                  <span className="inline-flex items-center gap-2 text-xs text-text-secondary">
                    <span className="size-2 rounded-full bg-slate-500" aria-hidden="true" />{d("notConnected")}
                  </span>
                </div>
                <div className="flex min-h-[500px] flex-col bg-[#080d16] p-4 sm:min-h-[620px]">
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <Terminal size={32} aria-hidden="true" className="text-text-secondary" />
                    <p className="text-sm font-medium text-text-primary">{d("consoleUnavailable")}</p>
                    <p className="max-w-sm text-xs leading-6 text-text-secondary">{d("consoleInfo")}</p>
                    {isDemoMode && (
                      <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">{d("demoConsole")}</span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input type="text" disabled placeholder={d("commandPlaceholder")} aria-label={d("consoleCommand")}
                      className="min-w-0 flex-1 rounded-xl border border-border-subtle bg-slate-950 px-4 py-3 font-mono text-sm text-text-secondary outline-none disabled:cursor-not-allowed" />
                    <button type="button" disabled aria-label={d("sendCommand")}
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white opacity-50">
                      <Send size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </section>
              <aside className="space-y-4">
                <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                  <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
                    <Wifi size={17} className="text-primary" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-text-primary">{d("network")}</h2>
                  </div>
                  <div className="divide-y divide-border-subtle px-4">
                    <div className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="text-text-secondary">{d("ipAddress")}</span>
                      <span className="text-text-primary">{d("notAvailable")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="text-text-secondary">{d("port")}</span>
                      <span className="text-text-primary">{d("notAvailable")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 py-3 text-sm">
                      <span className="text-text-secondary">{d("connection")}</span>
                      <span className="text-text-secondary">{d("notConnected")}</span>
                    </div>
                  </div>
                </section>
                <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                  <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
                    <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <Users size={17} className="text-primary" aria-hidden="true" />{d("players")}
                    </h2>
                    {previewServer && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {previewServer.players} / {previewServer.maxPlayers}
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-5 text-sm text-text-secondary">
                    {previewServer ? d("demoPlayers") : d("playersUnavailable")}
                  </div>
                </section>
                <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                  <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
                    <HardDrive size={17} className="text-primary" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-text-primary">{d("resourceUsage")}</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-3 p-4">
                    {resourceItems.map((resource) => (
                      <div key={resource.key} className="flex flex-col items-center gap-3">
                        <span className={`text-xs font-medium ${resource.color}`}>
                          {resource.key === "cpu" ? "CPU" : d(resource.key)}
                        </span>
                        <div className="flex size-20 items-center justify-center rounded-full border-[6px] border-white/10">
                          <span className="text-xs font-semibold text-text-secondary">N/A</span>
                        </div>
                        <span className="text-center text-xs text-text-secondary">{d("noData")}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="flex items-start gap-2 rounded-xl border border-border-subtle bg-surface p-4 text-xs leading-5 text-text-secondary">
                  <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                  {d("resourceInfo")}
                </div>
              </aside>
            </div>
          ) : (
            <section className="rounded-2xl border border-dashed border-border-subtle bg-surface p-8 text-center sm:p-12">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ActiveSectionIcon size={26} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-text-primary">{activeSectionConfig?.label}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">{d("plannedSection")}</p>
            </section>
          )}
        </>
      ) : null}

      {server && !showError && (
        <ServerUploadWidget
          transfers={uploadTransfers.filter((transfer) => !dismissedTransferIds.includes(transfer.id))}
          open={uploadsOpen}
          onClose={() => setUploadsOpen(false)}
          onRemoveTransfer={(id) => setDismissedTransferIds((previous) => [...previous, id])}
          onClearFinished={() => setDismissedTransferIds((previous) => Array.from(new Set([
            ...previous,
            ...uploadTransfers.filter((transfer) => transfer.state === "complete" || transfer.state === "error").map((transfer) => transfer.id),
          ])))}
        />
      )}
    </div>
  );
};
