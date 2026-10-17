import type { RefObject } from "react";
import { Copy, Download, FileCode2, FolderOpen, Info, MoveRight, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ContextMenu, DemoEntry } from "../../types/files.types";

type Props = {
  menuRef: RefObject<HTMLDivElement | null>;
  position: ContextMenu;
  entry: DemoEntry;
  canEdit: boolean;
  canDownload: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDetails: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onDelete: () => void;
};

const itemClass = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-text-primary hover:bg-white/10";

export const FilesContextMenu = ({ menuRef, position, entry, canEdit, canDownload, onOpen, onEdit, onDetails, onRename, onMove, onCopy, onDownload, onDelete }: Props) => {
  const { t } = useTranslation();
  return (
    <div ref={menuRef} role="menu" aria-label={t("servers.files.contextMenu.actionsFor", { defaultValue: "Actions for {{name}}", name: entry.name })}
      style={{ position: "fixed", left: position.x, top: position.y, width: 208 }}
      className="z-50 rounded-xl border border-border-subtle bg-slate-900 p-1.5 shadow-2xl shadow-black/40">
      {entry.kind === "folder" && <button type="button" role="menuitem" onClick={onOpen} className={itemClass}><FolderOpen size={16} aria-hidden="true" />{t("servers.files.actions.open", { defaultValue: "Open" })}</button>}
      {canEdit && <button type="button" role="menuitem" onClick={onEdit} className={itemClass}><FileCode2 size={16} aria-hidden="true" />{t("servers.files.actions.edit", { defaultValue: "Edit" })}</button>}
      <button type="button" role="menuitem" onClick={onDetails} className={itemClass}><Info size={16} aria-hidden="true" />{t("servers.files.actions.details", { defaultValue: "Details" })}</button>
      <div className="my-1 border-t border-border-subtle" />
      <button type="button" role="menuitem" onClick={onRename} className={itemClass}><Pencil size={16} aria-hidden="true" />{t("servers.files.actions.rename", { defaultValue: "Rename" })}</button>
      <button type="button" role="menuitem" onClick={onMove} className={itemClass}><MoveRight size={16} aria-hidden="true" />{t("servers.files.actions.move", { defaultValue: "Move" })}</button>
      <button type="button" role="menuitem" onClick={onCopy} className={itemClass}><Copy size={16} aria-hidden="true" />{t("servers.files.actions.copy", { defaultValue: "Copy" })}</button>
      <button type="button" role="menuitem" disabled={!canDownload}
        title={entry.kind === "folder"
          ? t("servers.files.contextMenu.folderDownloadUnsupported", { defaultValue: "Folder download is not supported yet" })
          : canDownload ? t("servers.files.contextMenu.downloadDemoFile", { defaultValue: "Download demo file" })
          : t("servers.files.contextMenu.contentUnavailable", { defaultValue: "File content is not available in demo memory" })}
        onClick={onDownload} className={`${itemClass} disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-50`}><Download size={16} aria-hidden="true" />{t("servers.files.actions.download", { defaultValue: "Download" })}</button>
      <div className="my-1 border-t border-border-subtle" />
      <button type="button" role="menuitem" onClick={onDelete} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10"><Trash2 size={16} aria-hidden="true" />{t("servers.files.actions.delete", { defaultValue: "Delete" })}</button>
    </div>
  );
};
