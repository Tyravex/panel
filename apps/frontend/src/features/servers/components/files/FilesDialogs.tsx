import { useEffect, useRef } from "react";
import { Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DemoEntry, FileDialog, TransferDialog } from "../../types/files.types";

type Props = {
  dialog: FileDialog | null;
  dialogName: string;
  dialogError: string;
  deleteTarget: DemoEntry | null;
  bulkDeletePaths: string[];
  transferDialog: TransferDialog | null;
  transferDestination: string;
  transferError: string;
  transferFolders: { path: string; name: string }[];
  transferSourcePath: string;
  onCloseName: () => void;
  onNameChange: (name: string) => void;
  onClearNameError: () => void;
  onSubmitName: () => void;
  onCloseDelete: () => void;
  onConfirmDelete: () => void;
  onCloseTransfer: () => void;
  onDestinationChange: (path: string) => void;
  onClearTransferError: () => void;
  onSubmitTransfer: () => void;
};

export function FilesDialogs({ dialog, dialogName, dialogError, deleteTarget, bulkDeletePaths,
  transferDialog, transferDestination, transferError, transferFolders, transferSourcePath,
  onCloseName, onNameChange, onClearNameError, onSubmitName,
  onCloseDelete, onConfirmDelete, onCloseTransfer, onDestinationChange,
  onClearTransferError, onSubmitTransfer }: Props) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (dialog) inputRef.current?.focus(); }, [dialog]);
  const folders = transferFolders;
  const source = { path: transferSourcePath };
  return <>
      {dialog && (
        <div
          role="presentation"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onCloseName();
            }
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitName();
            }}
            className="w-full max-w-md rounded-2xl border border-border-subtle bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-text-primary">
                {dialog.action === "new-file"
                  ? t("servers.files.actions.newFile", { defaultValue: "New file" })
                  : dialog.action === "new-folder"
                    ? t("servers.files.actions.newFolder", { defaultValue: "New folder" })
                    : t("servers.files.actions.rename", { defaultValue: "Rename" })}
              </h3>
              <button
                type="button"
                aria-label={t("servers.files.actions.close", { defaultValue: "Close" })}
                onClick={() => onCloseName()}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-white/10"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <label
              htmlFor="demo-file-name"
              className="mb-2 block text-sm text-text-secondary"
            >
              {t("servers.files.labels.name", { defaultValue: "Name" })}
            </label>
            <input
              ref={inputRef}
              id="demo-file-name"
              value={dialogName}
              onChange={(event) => {
                onNameChange(event.target.value);
                onClearNameError();
              }}
              className="w-full rounded-lg border border-border-subtle bg-slate-950/50 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary"
              placeholder={
                dialog.action === "new-file"
                  ? "example.json"
                  : t("servers.files.labels.folderName", { defaultValue: "Folder name" })
              }
            />

            {dialogError && (
              <p className="mt-2 text-sm text-rose-400">
                {dialogError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onCloseName()}
                className="rounded-lg border border-border-subtle px-4 py-2 text-sm text-text-secondary hover:bg-white/5"
              >
                {t("servers.files.actions.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                {dialog.action === "rename" ? t("servers.files.actions.rename", { defaultValue: "Rename" }) : t("servers.files.dialogs.create", { defaultValue: "Create" })}
              </button>
            </div>
          </form>
        </div>
      )}

      {(deleteTarget || bulkDeletePaths.length > 0) && (
        <div
          role="presentation"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onCloseDelete();
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="w-full max-w-md rounded-2xl border border-border-subtle bg-slate-900 p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-rose-500/10 p-3 text-rose-400">
                <Trash2 size={22} aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  id="delete-dialog-title"
                  className="text-lg font-semibold text-text-primary"
                >
                  {bulkDeletePaths.length ? t("servers.files.dialogs.deleteItems", { count: bulkDeletePaths.length, defaultValue: "Delete {{count}} items?" }) : deleteTarget?.kind === "folder" ? t("servers.files.dialogs.deleteFolder", { defaultValue: "Delete folder?" }) : t("servers.files.dialogs.deleteFile", { defaultValue: "Delete file?" })}
                </h3>

                <p
                  id="delete-dialog-description"
                  className="mt-2 text-sm leading-6 text-text-secondary"
                >
                  {t("servers.files.dialogs.areYouSure", { defaultValue: "Are you sure you want to delete" })}{" "}
                  <span className="break-all font-semibold text-text-primary">
                    {bulkDeletePaths.length ? t("servers.files.labels.selectedCount", { count: bulkDeletePaths.length, defaultValue: "{{count}} selected" }) : deleteTarget?.name}
                  </span>
                  ?
                </p>

                {(bulkDeletePaths.length > 0 || deleteTarget?.kind === "folder") && (
                  <p className="mt-2 text-sm text-rose-400">
                    {t("servers.files.dialogs.deleteChildren", { defaultValue: "Files and subfolders inside selected folders will also be deleted." })}
                  </p>
                )}

                <p className="mt-3 text-xs text-text-secondary">
                  {t("servers.files.dialogs.cannotUndo", { defaultValue: "This action cannot be undone in the demo session." })}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { onCloseDelete(); }}
                className="rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                {t("servers.files.actions.cancel", { defaultValue: "Cancel" })}
              </button>

              <button
                type="button"
                onClick={onConfirmDelete}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
              >
                <Trash2 size={16} aria-hidden="true" />
                {t("servers.files.actions.delete", { defaultValue: "Delete" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {transferDialog && (() => {
        return (
          <div
            role="presentation"
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                onCloseTransfer();
              }
            }}
          >
            <form
              role="dialog"
              aria-modal="true"
              aria-labelledby="transfer-dialog-title"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitTransfer();
              }}
              className="w-full max-w-md rounded-2xl border border-border-subtle bg-slate-900 p-6 shadow-2xl shadow-black/50"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3
                    id="transfer-dialog-title"
                    className="text-lg font-semibold text-text-primary"
                  >
                    {transferDialog.action === "move" ? t("servers.files.dialogs.moveItems", { defaultValue: "Move items" }) : t("servers.files.dialogs.copyItems", { defaultValue: "Copy items" })}
                  </h3>
                  <p className="mt-2 break-all text-sm text-text-secondary">
                    {transferDialog.sourcePaths ? t("servers.files.labels.selectedCount", { count: transferDialog.sourcePaths.length, defaultValue: "{{count}} selected" }) : source?.path ?? transferDialog.sourcePath}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("servers.files.actions.close", { defaultValue: "Close" })}
                  onClick={() => onCloseTransfer()}
                  className="rounded-lg p-1.5 text-text-secondary hover:bg-white/10"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3">
                <label
                  htmlFor="demo-transfer-destination"
                  className="block text-sm text-text-secondary"
                >
                  {t("servers.files.labels.destination", { defaultValue: "Destination folder" })}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onDestinationChange("/");
                    onClearTransferError();
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    transferDestination === "/"
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border-subtle text-text-secondary hover:bg-white/5 hover:text-text-primary"
                  }`}
                >
                  {t("servers.files.actions.goToRoot", { defaultValue: "Root directory (/)" })}
                </button>
              </div>
              <select
                id="demo-transfer-destination"
                value={transferDestination}
                onChange={(event) => {
                  onDestinationChange(event.target.value);
                  onClearTransferError();
                }}
                className="w-full rounded-lg border border-border-subtle bg-slate-950 px-3 py-2.5 text-sm text-text-primary outline-none focus:border-primary"
              >
                {folders.map((folder) => (
                  <option key={folder.path} value={folder.path}>
                    {folder.name}
                  </option>
                ))}
              </select>

              <p className="mt-2 break-all text-xs text-text-secondary">
                {t("servers.files.dialogs.selectedDestination", { defaultValue: "Selected destination:" })} <span className="font-medium text-text-primary">{transferDestination}</span>
              </p>

              {transferError && (
                <p role="alert" className="mt-3 text-sm text-rose-400">
                  {transferError}
                </p>
              )}

              <p className="mt-3 text-xs text-text-secondary">
                {t("servers.files.dialogs.demoNotice", { defaultValue: "Demo only. This operation does not change server files." })}
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onCloseTransfer()}
                  className="rounded-lg border border-border-subtle px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5"
                >
                  {t("servers.files.actions.cancel", { defaultValue: "Cancel" })}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                >
                  {transferDialog.action === "move" ? t("servers.files.actions.move", { defaultValue: "Move" }) : t("servers.files.actions.copy", { defaultValue: "Copy" })}
                </button>
              </div>
            </form>
          </div>
        );
      })()}

  </>;
}
