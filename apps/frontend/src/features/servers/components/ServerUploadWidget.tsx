import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, UploadCloud, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export type UploadTransfer = {
  id: string;
  name: string;
  progress: number;
  state: "queued" | "uploading" | "complete" | "error";
  detail?: string;
};

type Props = {
  transfers: UploadTransfer[];
  open?: boolean;
  onClose?: () => void;
  onRemoveTransfer?: (id: string) => void;
  onClearFinished?: () => void;
};

// Displays progress reported by the upload transport or local demo file reader.
export const ServerUploadWidget = ({ transfers, open = false, onClose, onRemoveTransfer, onClearFinished }: Props) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(open);

  useEffect(() => {
    if (open) setExpanded(true);
  }, [open]);

  const active = transfers.filter(
    (transfer) => transfer.state === "uploading" || transfer.state === "queued",
  ).length;

  const finishedCount = transfers.filter((transfer) => transfer.state === "complete" || transfer.state === "error").length;

  if (!open) return null;

  return (
    <aside
      aria-label={t("servers.uploads.title", { defaultValue: "Uploads" })}
      className="fixed bottom-4 right-4 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl shadow-black/40"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <UploadCloud size={19} aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-sm font-semibold text-text-primary">
            {t("servers.uploads.title", { defaultValue: "Uploads" })} ({transfers.length})
          </span>
          <span className="block text-xs text-text-secondary">
            {active ? t("servers.uploads.activeCount", { count: active, defaultValue: "{{count}} active" }) : t("servers.uploads.noActive", { defaultValue: "No active transfers" })}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? t("servers.uploads.collapse", { defaultValue: "Collapse uploads" }) : t("servers.uploads.expand", { defaultValue: "Expand uploads" })}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-white/10"
        >
          {expanded ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
        </button>
        {onClearFinished && finishedCount > 0 && (
          <button
            type="button"
            onClick={onClearFinished}
            title={t("servers.uploads.clearAllHint", { defaultValue: "Remove all completed and failed transfers from history" })}
            aria-label={t("servers.uploads.clearFinished", { defaultValue: "Clear finished uploads" })}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/10 hover:text-text-primary"
          >
            {t("servers.uploads.clearAll", { defaultValue: "Clear all" })}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("servers.uploads.close", { defaultValue: "Close uploads" })}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-white/10"
          >
            <X size={17} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="max-h-72 space-y-2 overflow-y-auto border-t border-border-subtle p-3">
          {transfers.length === 0 ? (
            <p className="px-2 py-5 text-center text-xs text-text-secondary">
              {t("servers.uploads.empty", { defaultValue: "No transfers yet. Select files or drag them into Files." })}
            </p>
          ) : transfers.map((transfer) => {
            const progress = Math.max(0, Math.min(100, transfer.progress));
            return (
              <div key={transfer.id} className="rounded-xl border border-border-subtle bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium text-text-primary" title={transfer.name}>
                    {transfer.name}
                  </span>
                  <span className="shrink-0 text-text-secondary">{progress}%</span>
                  {onRemoveTransfer && transfer.state !== "uploading" && transfer.state !== "queued" && (
                    <button type="button" onClick={() => onRemoveTransfer(transfer.id)} aria-label={t("servers.uploads.removeNamed", { name: transfer.name, defaultValue: "Remove {{name}} from upload history" })} title={t("servers.uploads.removeEntry", { defaultValue: "Remove from history" })} className="rounded-md p-1 text-text-secondary hover:bg-white/10 hover:text-text-primary"><X size={14} /></button>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-label={transfer.name}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className={`h-full rounded-full transition-[width] ${transfer.state === "error" ? "bg-rose-500" : transfer.state === "complete" ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className={`mt-1.5 text-xs ${transfer.state === "error" ? "text-rose-400" : "text-text-secondary"}`}>
                  {transfer.detail ?? t(`servers.uploads.${transfer.state}`, { defaultValue: transfer.state })}
                </p>
              </div>
            );
          })}
          <p className="px-1 text-xs text-text-secondary">
            {t("servers.uploads.demoNotice", { defaultValue: "Demo progress measures local file reading, not server upload." })}
          </p>
        </div>
      )}
    </aside>
  );
};
