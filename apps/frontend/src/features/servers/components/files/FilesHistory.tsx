import { History, Redo2, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FileHistoryAction } from "../../hooks/useDemoFileSystem";

type Item = { id: number; action: FileHistoryAction; detail: string; applied: boolean };
type Props = {
  items: Item[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function FilesHistory({ items, canUndo, canRedo, onUndo, onRedo }: Props) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-4" aria-label={t("servers.files.history.title", { defaultValue: "Operation history" })}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <History size={17} aria-hidden="true" />
          {t("servers.files.history.title", { defaultValue: "Operation history" })}
        </h3>
        <div className="flex gap-2">
          <button type="button" disabled={!canUndo} onClick={onUndo} className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">
            <Undo2 size={14} aria-hidden="true" />{t("servers.files.history.undo", { defaultValue: "Undo" })}
          </button>
          <button type="button" disabled={!canRedo} onClick={onRedo} className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs text-text-secondary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">
            <Redo2 size={14} aria-hidden="true" />{t("servers.files.history.redo", { defaultValue: "Redo" })}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-text-secondary">{t("servers.files.history.notice", { defaultValue: "Demo history is kept in memory and resets when the page reloads. Maximum 30 operations." })}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">{t("servers.files.history.empty", { defaultValue: "No operations yet." })}</p>
      ) : (
        <ol className="mt-3 max-h-44 space-y-1 overflow-y-auto" aria-live="polite">
          {[...items].reverse().map((item) => (
            <li key={item.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${item.applied ? "text-text-secondary" : "text-text-secondary opacity-50"}`}>
              <span className="min-w-16 font-medium">{t(`servers.files.history.actions.${item.action}`, { defaultValue: item.action })}</span>
              <span className="min-w-0 flex-1 break-all">{item.detail}</span>
              {!item.applied && <span>{t("servers.files.history.undone", { defaultValue: "Undone" })}</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
