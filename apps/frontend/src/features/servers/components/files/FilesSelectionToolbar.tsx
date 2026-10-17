import { useTranslation } from "react-i18next";

type Props = {
  count: number;
  onMove: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClear: () => void;
};

export const FilesSelectionToolbar = ({ count, onMove, onCopy, onDelete, onClear }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-primary/5 px-4 py-2 text-sm">
      <span className="mr-auto text-text-primary">{t("servers.files.labels.selectedCount", { count, defaultValue: "{{count}} selected" })}</span>
      <button type="button" onClick={onMove} className="rounded-lg border border-border-subtle px-3 py-1.5 text-text-secondary hover:bg-white/10">{t("servers.files.actions.move", { defaultValue: "Move" })}</button>
      <button type="button" onClick={onCopy} className="rounded-lg border border-border-subtle px-3 py-1.5 text-text-secondary hover:bg-white/10">{t("servers.files.actions.copy", { defaultValue: "Copy" })}</button>
      <button type="button" onClick={onDelete} className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-rose-400 hover:bg-rose-500/10">{t("servers.files.actions.delete", { defaultValue: "Delete" })}</button>
      <button type="button" onClick={onClear} className="rounded-lg px-3 py-1.5 text-text-secondary hover:bg-white/10">{t("servers.files.actions.clearSelection", { defaultValue: "Clear" })}</button>
    </div>
  );
};
