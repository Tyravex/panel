import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Archive,
  PackageOpen,
  FileCode2,
  Eye,
  File,
  Folder,
  FilePlus,
  FolderPlus,
  Info,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { ServerFileEditor } from "./ServerFileEditor";
import { FilesBreadcrumbs } from "./files/FilesBreadcrumbs";
import { FilesSelectionToolbar } from "./files/FilesSelectionToolbar";
import { FilesContextMenu } from "./files/FilesContextMenu";
import { FilesDialogs } from "./files/FilesDialogs";
import { FilesPreview } from "./files/FilesPreview";
import { FilesHistory } from "./files/FilesHistory";
import { FilesExplorerFilters } from "./files/FilesExplorerFilters";
import { filterExplorerEntries } from "../utils/files/explorer";
import type { ExplorerOptions } from "../utils/files/explorer";
import { useFileSelection } from "../hooks/useFileSelection";
import { useDemoFileSystem } from "../hooks/useDemoFileSystem";
import type { UploadTransfer as WidgetUploadTransfer } from "./ServerUploadWidget";
import { useDemoFileUpload } from "../hooks/useDemoFileUpload";
import { useFileKeyboardShortcuts } from "../hooks/useFileKeyboardShortcuts";

import type { ContextMenu, DemoEntry, FileDialog, TransferDialog } from "../types/files.types";
import { getParent, isWithin, joinPath } from "../utils/files/paths";
import { isEditableFile, validateName } from "../utils/files/validation";
import { getEntryIcon } from "../utils/files/icons";
import { createZip, extractZip, downloadBlob } from "../utils/files/zip";

type Props = {
  isDemoMode: boolean;
  onOpenUploads?: () => void;
  onTransfersChange?: (transfers: WidgetUploadTransfer[]) => void;
};

const MENU_WIDTH = 208;
const MENU_HEIGHT = 350;
const MENU_MARGIN = 12;

export const ServerFilesPanel = ({
  isDemoMode,
  onOpenUploads,
  onTransfersChange,
}: Props) => {
  const { t } = useTranslation();

  const [directory, setDirectory] = useState("/");
  const [search, setSearch] = useState("");
  const [explorer, setExplorer] = useState<Omit<ExplorerOptions, "directory" | "query" | "favorites">>({
    scope: "current", type: "all", sort: "name", order: "asc", showHidden: true, favoritesOnly: false,
  });
  const [favorites, setFavorites] = useState<string[]>([]);
  const updateExplorer = (patch: Partial<ExplorerOptions>) => {
    setExplorer((previous) => ({ ...previous, ...patch }));
    setSelectedPaths([]);
    setSelectedPath(null);
    setSelectionAnchor(null);
  };
  const resetExplorer = () => {
    setSearch("");
    updateExplorer({ scope: "current", type: "all", sort: "name", order: "asc", showHidden: true, favoritesOnly: false });
  };
  const toggleFavorite = (path: string) => setFavorites((previous) =>
    previous.includes(path) ? previous.filter((item) => item !== path) : [...previous, path]
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [bulkDeletePaths, setBulkDeletePaths] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const {
    demoEntries, demoEntriesRef, fileContents, binaryFiles,
    createEntry, renameEntry, transferEntries, removeEntries,
    saveContent, appendUploads, undo, redo, canUndo, canRedo, historyItems,
  } = useDemoFileSystem();
  const [dialog, setDialog] = useState<FileDialog | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DemoEntry | null>(null);
  const [transferDialog, setTransferDialog] = useState<TransferDialog | null>(null);
  const [transferDestination, setTransferDestination] = useState("/");
  const [transferError, setTransferError] = useState("");

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { uploadError, setUploadError, uploadSuccess, setUploadSuccess, isDraggingFiles, setIsDraggingFiles, uploadFiles, uploadDroppedItems } = useDemoFileUpload({
    isDemoMode, directory, demoEntriesRef, appendUploads, onOpenUploads, onTransfersChange,
    onUploaded: (lastPath) => { setSearch(""); setSelectedPath(lastPath); },
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [clipboard, setClipboard] = useState<{ paths: string[]; action: "move" | "copy" } | null>(null);
  const [clipboardError, setClipboardError] = useState("");
  const [zipBusy, setZipBusy] = useState(false);
  const [zipError, setZipError] = useState("");
  const [zipSuccess, setZipSuccess] = useState("");

  const allEntries = isDemoMode ? demoEntries : [];

  const entries = useMemo(() => isDemoMode
    ? filterExplorerEntries(demoEntries, { ...explorer, directory, query: search, favorites })
    : [], [demoEntries, directory, isDemoMode, search, explorer, favorites]);

  const selected = allEntries.find((entry) => entry.path === selectedPath);
  const editingEntry = allEntries.find((entry) => entry.path === editingPath);
  const previewEntry = allEntries.find((entry) => entry.path === previewPath);
  const menuEntry = allEntries.find(
    (entry) => entry.path === contextMenu?.path,
  );

  const navigate = (path: string) => {
    setDirectory(path);
    setSelectedPath(null);
    setSelectedPaths([]);
    setSelectionAnchor(null);
    setContextMenu(null);
    setEditingPath(null);
    setSearch("");
  };

  const { selectedPaths, setSelectedPaths, setSelectionAnchor, selectEntry, selectedRoots } = useFileSelection(entries);

  const openBulkTransfer = (action: "move" | "copy") => {
    if (!isDemoMode || selectedRoots.length === 0) return;
    setTransferDialog({ action, sourcePath: selectedRoots[0], sourcePaths: [...selectedRoots] });
    setTransferDestination(directory);
    setTransferError("");
    setContextMenu(null);
  };

  const openEditor = (entry: DemoEntry) => {
    if (!isDemoMode || !isEditableFile(entry) || binaryFiles[entry.path]) return;

    setEditingPath(entry.path);
    setSelectedPath(entry.path);
    setContextMenu(null);
  };

  const openContextMenu = (
    entry: DemoEntry,
    clientX: number,
    clientY: number,
  ) => {
    const x = Math.max(
      MENU_MARGIN,
      Math.min(clientX, window.innerWidth - MENU_WIDTH - MENU_MARGIN),
    );

    const y = Math.max(
      MENU_MARGIN,
      Math.min(clientY, window.innerHeight - MENU_HEIGHT - MENU_MARGIN),
    );

    if (!selectedPaths.includes(entry.path)) {
      setSelectedPaths([entry.path]);
      setSelectionAnchor(entry.path);
    }
    setSelectedPath(entry.path);
    setContextMenu({ path: entry.path, x, y });
  };

  const openDialog = (
    action: FileDialog["action"],
    path?: string,
  ) => {
    if (!isDemoMode) return;

    const entry = path
      ? demoEntries.find((item) => item.path === path)
      : undefined;

    setDialog({ action, path });
    setDialogName(action === "rename" ? entry?.name ?? "" : "");
    setDialogError("");
    setContextMenu(null);
  };

  const submitDialog = () => {
    if (!isDemoMode || !dialog) return;

    const name = dialogName.trim();
    const error = validateName(name);

    if (error) {
      setDialogError(error);
      return;
    }

    if (dialog.action === "rename") {
      const original = demoEntries.find(
        (entry) => entry.path === dialog.path,
      );

      if (!original) {
        setDialog(null);
        return;
      }

      const nextPath = joinPath(getParent(original.path), name);

      if (nextPath === original.path) {
        setDialog(null);
        return;
      }

      if (demoEntries.some((entry) => entry.path === nextPath)) {
        setDialogError("An item with this name already exists.");
        return;
      }

      renameEntry(original.path, nextPath, name);

      setSelectedPath((previous) =>
        previous && isWithin(previous, original.path)
          ? nextPath + previous.slice(original.path.length)
          : previous,
      );

      setEditingPath((previous) =>
        previous && isWithin(previous, original.path)
          ? nextPath + previous.slice(original.path.length)
          : previous,
      );

      setDirectory((previous) =>
        isWithin(previous, original.path)
          ? nextPath + previous.slice(original.path.length)
          : previous,
      );

    } else {
      const kind =
        dialog.action === "new-folder" ? "folder" : "file";

      const path = joinPath(directory, name);

      if (demoEntries.some((entry) => entry.path === path)) {
        setDialogError("An item with this name already exists.");
        return;
      }

      createEntry(path, name, kind);
      setSelectedPath(path);
      setSearch("");
    }

    setDialog(null);
    setDialogName("");
    setDialogError("");
  };

  const openTransferDialog = (
    action: TransferDialog["action"],
    entry: DemoEntry,
  ) => {
    if (!isDemoMode) return;

    setTransferDialog({ action, sourcePath: entry.path });
    setTransferDestination(getParent(entry.path));
    setTransferError("");
    setContextMenu(null);
  };

  const submitTransfer = () => {
    if (!isDemoMode || !transferDialog) return;
    const paths = transferDialog.sourcePaths ?? [transferDialog.sourcePath];
    const sources = paths.map((path) => demoEntries.find((entry) => entry.path === path));
    if (sources.some((entry) => !entry)) {
      setTransferError("One of the selected items no longer exists.");
      return;
    }
    const roots = sources.filter((entry): entry is DemoEntry => Boolean(entry));
    const destination = transferDestination;
    if (destination !== "/" && !demoEntries.some((entry) => entry.path === destination && entry.kind === "folder")) {
      setTransferError("Destination folder no longer exists.");
      return;
    }
    if (roots.some((source) => source.kind === "folder" && isWithin(destination, source.path))) {
      setTransferError("A folder cannot be moved or copied into itself.");
      return;
    }
    if (roots.some((source) => getParent(source.path) === destination)) {
      setTransferError("Select a different destination for all selected items.");
      return;
    }
    if (roots.some((source) => demoEntries.some((entry) => entry.path === joinPath(destination, source.name)))) {
      setTransferError("An item with one of these names already exists in the destination.");
      return;
    }
    const mapping = roots.map((source) => ({ oldPath: source.path, newPath: joinPath(destination, source.name) }));
    const remap = (path: string): string => {
      const match = mapping.find((item) => isWithin(path, item.oldPath));
      return match ? match.newPath + path.slice(match.oldPath.length) : path;
    };
    transferEntries(mapping, transferDialog.action);
    if (transferDialog.action === "move") {
      setEditingPath((previous) => previous ? remap(previous) : previous);
    }
    setSelectedPaths(mapping.map((item) => item.newPath));
    setSelectedPath(mapping[0]?.newPath ?? null);
    setSelectionAnchor(mapping[0]?.newPath ?? null);
    setSearch("");
    setTransferDialog(null);
    setTransferError("");
    setDirectory(destination);
  };

  const copySelection = (action: "move" | "copy") => {
    if (selectedRoots.length === 0) return;
    setClipboard({ paths: [...selectedRoots], action });
    setClipboardError("");
    setContextMenu(null);
  };

  const pasteSelection = () => {
    if (!clipboard || !isDemoMode) return;
    const roots = clipboard.paths.map((path) => demoEntriesRef.current.find((entry) => entry.path === path));
    if (roots.some((entry) => !entry)) {
      setClipboardError("Clipboard items no longer exist.");
      setClipboard(null);
      return;
    }
    const sources = roots.filter((entry): entry is DemoEntry => Boolean(entry));
    if (sources.some((entry) => entry.kind === "folder" && isWithin(directory, entry.path))) {
      setClipboardError("A folder cannot be pasted into itself.");
      return;
    }
    if (sources.some((entry) => getParent(entry.path) === directory)) {
      setClipboardError("Choose a different destination directory.");
      return;
    }
    const mapping = sources.map((entry) => ({ oldPath: entry.path, newPath: joinPath(directory, entry.name) }));
    if (mapping.some(({ newPath }) => demoEntriesRef.current.some((entry) => entry.path === newPath))) {
      setClipboardError("An item with this name already exists in the destination.");
      return;
    }
    transferEntries(mapping, clipboard.action);
    if (clipboard.action === "move") {
      setEditingPath((previous) => {
        if (!previous) return previous;
        const match = mapping.find(({ oldPath }) => isWithin(previous, oldPath));
        return match ? match.newPath + previous.slice(match.oldPath.length) : previous;
      });
      setClipboard(null);
    }
    const paths = mapping.map(({ newPath }) => newPath);
    setSelectedPaths(paths);
    setSelectedPath(paths[0] ?? null);
    setSelectionAnchor(paths[0] ?? null);
    setSearch("");
    setClipboardError("");
  };

  useFileKeyboardShortcuts(panelRef, isDemoMode && !editingEntry, {
    selectAll: () => {
      const paths = entries.map((entry) => entry.path);
      setSelectedPaths(paths);
      setSelectedPath(paths[0] ?? null);
      setSelectionAnchor(paths[0] ?? null);
    },
    copy: () => copySelection("copy"),
    cut: () => copySelection("move"),
    paste: pasteSelection,
    remove: () => {
      if (selectedRoots.length === 0) return;
      setDeleteTarget(null);
      setBulkDeletePaths([...selectedRoots]);
      setContextMenu(null);
    },
    rename: () => {
      if (selectedRoots.length !== 1) return;
      openDialog("rename", selectedRoots[0]);
    },
  });

  const archiveSelection = async (downloadOnly: boolean) => {
    if (!isDemoMode || zipBusy || selectedRoots.length === 0) return;
    setZipBusy(true);
    setZipError("");
    setZipSuccess("");
    try {
      const archive = await createZip(selectedRoots, { entries: demoEntriesRef.current, texts: fileContents, binaries: binaryFiles });
      const baseName = selectedRoots.length === 1
        ? selectedRoots[0].split("/").pop() || "archive"
        : "selection";
      const filename = `${baseName.replace(/\.zip$/i, "")}.zip`;
      if (downloadOnly) {
        downloadBlob(archive, filename);
      } else {
        const path = joinPath(directory, filename);
        if (demoEntriesRef.current.some((entry) => entry.path === path)) {
          throw new Error("An item with this ZIP name already exists.");
        }
        appendUploads([{
          path, name: filename, kind: "file", modified: new Date().toLocaleString("en-GB"),
          size: `${(archive.size / 1024).toFixed(1)} KB`,
        }], {}, { [path]: archive });
        setSelectedPath(path);
        setSearch("");
      }
      setZipSuccess(downloadOnly ? "ZIP downloaded." : "ZIP created.");
    } catch (error) {
      setZipError(error instanceof Error ? error.message : "ZIP operation failed.");
    } finally {
      setZipBusy(false);
    }
  };

  const extractSelection = async () => {
    if (!isDemoMode || zipBusy || selectedRoots.length !== 1) return;
    const entry = demoEntriesRef.current.find((item) => item.path === selectedRoots[0]);
    if (!entry || entry.kind !== "file" || !entry.name.toLowerCase().endsWith(".zip")) return;
    setZipBusy(true);
    setZipError("");
    setZipSuccess("");
    try {
      const blob = binaryFiles[entry.path] ??
        (Object.prototype.hasOwnProperty.call(fileContents, entry.path)
          ? new Blob([fileContents[entry.path]]) : null);
      if (!blob) throw new Error("ZIP content is unavailable in demo memory.");
      const extracted = await extractZip(blob, directory, demoEntriesRef.current);
      if (extracted.entries.length === 0) throw new Error("ZIP has no files or folders to extract.");
      appendUploads(extracted.entries, extracted.texts, extracted.binaries);
      setZipSuccess(`Extracted ${extracted.entries.length} items.`);
      setSearch("");
    } catch (error) {
      setZipError(error instanceof Error ? error.message : "ZIP extraction failed.");
    } finally {
      setZipBusy(false);
    }
  };

  const restoreHistory = (action: "undo" | "redo") => {
    const changed = action === "undo" ? undo() : redo();
    if (!changed) return;
    // Paths may change when an earlier operation is restored.
    setEditingPath(null);
    setPreviewPath(null);
    setSelectedPath(null);
    setSelectedPaths([]);
    setSelectionAnchor(null);
    setContextMenu(null);
    setClipboard(null);
    setSearch("");
    setDirectory("/");
    setDialog(null);
    setDeleteTarget(null);
    setBulkDeletePaths([]);
    setTransferDialog(null);
    setZipError("");
    setZipSuccess("");
  };

  const canDownload = (entry: DemoEntry): boolean =>
    isDemoMode && entry.kind === "file";

  const downloadEntry = (entry: DemoEntry) => {
    if (!canDownload(entry)) return;

    const hasText = Object.prototype.hasOwnProperty.call(fileContents, entry.path);
    const hasBinary = Object.prototype.hasOwnProperty.call(binaryFiles, entry.path);
    const blob = hasBinary
      ? binaryFiles[entry.path]
      : new Blob([
          hasText
            ? fileContents[entry.path]
            : `Demo placeholder for ${entry.path}\nOriginal file contents are not available in demo mode.\n`,
        ], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, hasBinary || hasText ? entry.name : `${entry.name}.demo-placeholder.txt`);
    setContextMenu(null);
  };

  const openPreview = (entry: DemoEntry) => {
    if (!isDemoMode || entry.kind !== "file") return;
    setPreviewPath(entry.path);
    setContextMenu(null);
  };

  const deleteEntry = (entry: DemoEntry) => {
    if (!isDemoMode) return;

    setBulkDeletePaths([]);
    setDeleteTarget(entry);
    setContextMenu(null);
  };

  const confirmDelete = () => {
    if (!isDemoMode || (!deleteTarget && bulkDeletePaths.length === 0)) return;

    const paths = bulkDeletePaths.length ? bulkDeletePaths : deleteTarget ? [deleteTarget.path] : [];
    const shouldDelete = (path: string) => paths.some((root) => isWithin(path, root));

    removeEntries(paths);

    if (selectedPath && shouldDelete(selectedPath)) {
      setSelectedPath(null);
    }

    if (editingPath && shouldDelete(editingPath)) {
      setEditingPath(null);
    }

    if (shouldDelete(directory)) {
      navigate(getParent(paths[0]));
    }

    setSelectedPaths((previous) => previous.filter((path) => !shouldDelete(path)));
    setBulkDeletePaths([]);
    setDeleteTarget(null);
    setContextMenu(null);
  };

  const saveFileContent = (path: string, content: string) => {
    if (!isDemoMode) return;

    saveContent(path, content);
  };

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      // Right-click must not dismiss a menu that is being opened.
      if (event.button === 2) return;

      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);


  if (editingEntry && isEditableFile(editingEntry) && !binaryFiles[editingEntry.path]) {
    return (
      <div className="space-y-4">
        <ServerFileEditor
          key={editingEntry.path}
          fileName={editingEntry.name}
          filePath={editingEntry.path}
          initialContent={fileContents[editingEntry.path] ?? ""}
          isDemoMode={isDemoMode}
          onSave={(content) =>
            saveFileContent(editingEntry.path, content)
          }
          onBack={() => setEditingPath(null)}
        />
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      tabIndex={0}
      aria-label="File manager"
      className="relative space-y-4"
      onDragEnter={(event) => {
        if (!isDemoMode || !Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setIsDraggingFiles(true);
      }}
      onDragOver={(event) => {
        if (!isDemoMode || !Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!isDemoMode) return;
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDraggingFiles(false);
        }
      }}
      onDrop={(event) => {
        if (!isDemoMode || !Array.from(event.dataTransfer.types).includes("Files")) return;
        event.preventDefault();
        setIsDraggingFiles(false);
        void uploadDroppedItems(event.dataTransfer);
      }}
    >
      {isDemoMode && isDraggingFiles && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-2xl border-2 border-primary bg-slate-950/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <Upload size={36} className="text-primary" aria-hidden="true" />
            <span className="text-lg font-semibold text-text-primary">Drop files to upload</span>
            <span className="text-sm text-text-secondary">Upload to {directory} · Files up to 100 MB each · Text editor up to 10 MB</span>
          </div>
        </div>
      )}
      {isDemoMode && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-text-secondary">
          <Info
            size={17}
            className="mt-0.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          {t("servers.files.demoNotice", {
            defaultValue:
              "Demo filesystem. Changes are temporary and are not written to the server.",
          })}
        </div>
      )}

      {clipboardError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          {clipboardError}
          <button type="button" onClick={() => setClipboardError("")} className="ml-3 underline">Dismiss</button>
        </div>
      )}
      {clipboard && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm text-text-secondary">
          <span>{clipboard.action === "copy" ? "Copied" : "Cut"} {clipboard.paths.length} item(s) · Ctrl+V to paste</span>
          <button type="button" onClick={pasteSelection} className="rounded-lg border border-border-subtle px-3 py-1 hover:bg-white/5">Paste here</button>
          <button type="button" onClick={() => setClipboard(null)} className="ml-auto underline">Clear</button>
        </div>
      )}
      {zipError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          {zipError}
          <button type="button" onClick={() => setZipError("")} className="ml-3 underline">{t("servers.files.zip.dismiss", { defaultValue: "Dismiss" })}</button>
        </div>
      )}
      {zipSuccess && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">{zipSuccess}</div>
      )}
      {uploadSuccess && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 size={17} aria-hidden="true" />
          {uploadSuccess}
          <button type="button" onClick={() => setUploadSuccess("")} aria-label="Dismiss upload message" className="ml-auto"><X size={16} /></button>
        </div>
      )}
      {uploadError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="whitespace-pre-line">{uploadError}</span>
          <button type="button" onClick={() => setUploadError("")} aria-label="Dismiss upload errors" className="ml-auto"><X size={16} /></button>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(270px,0.9fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle p-3">
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              className="hidden"
              aria-label="Select files to upload"
              onChange={(event) => {
                if (event.target.files) void uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={!isDemoMode}
              onClick={() => uploadInputRef.current?.click()}
              title={isDemoMode ? "Upload files to demo memory" : "Upload API not connected"}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload size={16} aria-hidden="true" />
              {t("servers.files.upload", {
                defaultValue: "Upload",
              })}
            </button>

            <input
              ref={(element) => {
                folderInputRef.current = element;
                if (element) element.setAttribute("webkitdirectory", "");
              }}
              type="file"
              multiple
              className="hidden"
              aria-label="Select folder to upload"
              onChange={(event) => {
                if (event.target.files) uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={!isDemoMode}
              onClick={() => folderInputRef.current?.click()}
              title={isDemoMode ? "Upload a folder and its files" : "Upload API not connected"}
              className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderPlus size={16} aria-hidden="true" />
              Upload Folder
            </button>

            <button
              type="button"
              disabled={!isDemoMode}
              onClick={() => openDialog("new-file")}
              title={isDemoMode ? "Create demo file" : "File API not connected"}
              className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FilePlus size={16} aria-hidden="true" />
              {t("servers.files.newFile", {
                defaultValue: "New File",
              })}
            </button>

            <button
              type="button"
              disabled={!isDemoMode}
              onClick={() => openDialog("new-folder")}
              title={isDemoMode ? "Create demo folder" : "File API not connected"}
              className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderPlus size={16} aria-hidden="true" />
              {t("servers.files.newFolder", {
                defaultValue: "New Folder",
              })}
            </button>

            <button
              type="button"
              disabled={!isDemoMode}
              onClick={() => {
                setSearch("");
                setSelectedPath(null);
                setContextMenu(null);
              }}
              title={isDemoMode ? "Refresh demo view" : "File API not connected"}
              className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {t("dashboard.servers.refresh", {
                defaultValue: "Refresh",
              })}
            </button>

            <div className="relative ml-auto min-w-[160px] flex-1 sm:max-w-60">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
              />
              <input
                aria-label="Search files"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("servers.files.search", {
                  defaultValue: "Search files...",
                })}
                className="w-full rounded-lg border border-border-subtle bg-slate-950/30 py-2 pl-9 pr-3 text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
          </div>

          <FilesBreadcrumbs directory={directory} onNavigate={navigate} />
          {isDemoMode && <FilesExplorerFilters
            options={{ ...explorer, directory, query: search, favorites }}
            onChange={updateExplorer}
            count={entries.length}
            onReset={resetExplorer}
          />}

          {isDemoMode && selectedPaths.length > 0 && (
            <FilesSelectionToolbar
              count={selectedPaths.length}
              onMove={() => openBulkTransfer("move")}
              onCopy={() => openBulkTransfer("copy")}
              onDelete={() => { setDeleteTarget(null); setBulkDeletePaths([...selectedRoots]); }}
              onClear={() => { setSelectedPaths([]); setSelectedPath(null); setSelectionAnchor(null); }}
            />
          )}

          {isDemoMode && selectedRoots.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2">
              <button type="button" disabled={zipBusy} onClick={() => void archiveSelection(false)} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:opacity-50">
                <Archive size={16} aria-hidden="true" />{t("servers.files.zip.compress", { defaultValue: "Compress to ZIP" })}
              </button>
              <button type="button" disabled={zipBusy} onClick={() => void archiveSelection(true)} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:opacity-50">
                <Download size={16} aria-hidden="true" />{t("servers.files.zip.download", { defaultValue: "Download as ZIP" })}
              </button>
              {selectedRoots.length === 1 && demoEntries.some((entry) => entry.path === selectedRoots[0] && entry.kind === "file" && entry.name.toLowerCase().endsWith(".zip")) && (
                <button type="button" disabled={zipBusy} onClick={() => void extractSelection()} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:opacity-50">
                  <PackageOpen size={16} aria-hidden="true" />{t("servers.files.zip.extract", { defaultValue: "Extract here" })}
                </button>
              )}
              {zipBusy && <span role="status" className="text-xs text-text-secondary">{t("servers.files.zip.processing", { defaultValue: "Processing ZIP..." })}</span>}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[510px] text-left text-sm">
              <thead className="border-b border-border-subtle bg-white/[0.03] text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t("servers.files.name", { defaultValue: "Name" })}
                  </th>
                  <th className="px-3 py-3 font-medium">
                    {t("servers.files.size", { defaultValue: "Size" })}
                  </th>
                  <th className="px-3 py-3 font-medium">
                    {t("servers.files.modified", { defaultValue: "Modified" })}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t("servers.files.actions", { defaultValue: "Actions" })}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border-subtle">
                {entries.map((entry) => (
                  <tr
                    key={entry.path}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      openContextMenu(entry, event.clientX, event.clientY);
                    }}
                    onDoubleClick={() => {
                      if (entry.kind === "folder") {
                        navigate(entry.path);
                      } else {
                        openEditor(entry);
                      }
                    }}
                    className={`transition-colors hover:bg-white/[0.04] ${selectedPaths.includes(entry.path) ? "bg-primary/10" : ""
                      }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(event) => selectEntry(entry.path, event.ctrlKey || event.metaKey, event.shiftKey)}
                        className="flex items-center gap-3 text-left text-text-primary hover:text-primary"
                      >
                        {entry.kind === "folder" ? (
                          <Folder
                            size={18}
                            aria-hidden="true"
                            className="shrink-0 text-amber-400"
                          />
                        ) : (
                          (() => {
                            const EntryIcon = getEntryIcon(entry, binaryFiles);
                            return <EntryIcon size={18} aria-hidden="true" className="shrink-0 text-text-secondary" />;
                          })()
                        )}
                        <span className="break-all">{entry.name}</span>
                        {explorer.scope !== "current" && <span className="block max-w-56 truncate text-xs text-text-secondary" title={entry.path}>{getParent(entry.path)}</span>}
                      </button>
                    </td>

                    <td className="px-3 py-3 text-text-secondary">
                      {entry.size ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {entry.modified}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {explorer.scope !== "current" && <button type="button" title={t("servers.files.explorer.goToFolder", { defaultValue: "Go to containing folder" })} aria-label={`${t("servers.files.explorer.goToFolder", { defaultValue: "Go to containing folder" })}: ${entry.name}`} onClick={() => navigate(getParent(entry.path))} className="rounded-lg px-2 py-1 text-xs text-primary hover:bg-white/10">↗</button>}
                        <button type="button" title={favorites.includes(entry.path) ? t("servers.files.explorer.removeFavorite", { defaultValue: "Remove favorite" }) : t("servers.files.explorer.addFavorite", { defaultValue: "Add favorite" })} aria-label={`${favorites.includes(entry.path) ? "Remove favorite" : "Add favorite"}: ${entry.name}`} aria-pressed={favorites.includes(entry.path)} onClick={() => toggleFavorite(entry.path)} className={`rounded-lg px-2 py-1 text-lg hover:bg-white/10 ${favorites.includes(entry.path) ? "text-amber-400" : "text-text-secondary"}`}>{favorites.includes(entry.path) ? "★" : "☆"}</button>
                      <button
                        type="button"
                        aria-label={`Actions for ${entry.name}`}
                        aria-expanded={contextMenu?.path === entry.path}
                        onClick={(event) => {
                          if (contextMenu?.path === entry.path) {
                            setContextMenu(null);
                            return;
                          }

                          const rect =
                            event.currentTarget.getBoundingClientRect();

                          openContextMenu(
                            entry,
                            rect.right - MENU_WIDTH,
                            rect.bottom + 6,
                          );
                        }}
                        className="rounded-lg p-1.5 text-text-secondary hover:bg-white/10 hover:text-text-primary"
                      >
                        <MoreHorizontal size={18} aria-hidden="true" />
                      </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {entries.length === 0 && (
              <div className="px-6 py-16 text-center text-sm text-text-secondary">
                {isDemoMode
                  ? t("servers.files.empty", {
                    defaultValue: "No matching files in this directory.",
                  })
                  : t("servers.files.notConnected", {
                    defaultValue:
                      "File manager is not connected to the server API yet.",
                  })}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-border-subtle bg-surface p-6">
          {selected ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3 border-b border-border-subtle pb-5 text-center">
                {selected.kind === "folder" ? (
                  <Folder
                    size={48}
                    aria-hidden="true"
                    className="text-amber-400"
                  />
                ) : (
                  (() => {
                    const EntryIcon = getEntryIcon(selected, binaryFiles);
                    return <EntryIcon size={48} aria-hidden="true" className="text-primary" />;
                  })()
                )}
                <h3 className="break-all font-semibold text-text-primary">
                  {selected.name}
                </h3>
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Type</dt>
                  <dd className="text-text-primary">{selected.kind}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Size</dt>
                  <dd className="text-text-primary">
                    {selected.size ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-secondary">Modified</dt>
                  <dd className="text-text-primary">{selected.modified}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                {isEditableFile(selected) && !binaryFiles[selected.path] && (
                  <button
                    type="button"
                    onClick={() => openEditor(selected)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <FileCode2 size={16} aria-hidden="true" />
                    Edit file
                  </button>
                )}

                {selected.kind === "file" && (
                  <button type="button" onClick={() => openPreview(selected)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20">
                    <Eye size={16} aria-hidden="true" />
                    {t("servers.files.preview.open", { defaultValue: "Preview" })}
                  </button>
                )}

                {selected.kind === "file" && (
                  <button
                    type="button"
                    disabled={!canDownload(selected)}
                    title={
                      canDownload(selected)
                        ? "Download demo file"
                        : "File content is not available in demo memory"
                    }
                    onClick={() => downloadEntry(selected)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download size={16} aria-hidden="true" />
                    Download
                  </button>
                )}

                <button
                  type="button"
                  disabled={!isDemoMode}
                  onClick={() => openDialog("rename", selected.path)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:bg-white/5 disabled:opacity-50"
                >
                  <Pencil size={16} aria-hidden="true" />
                  Rename
                </button>

                <button
                  type="button"
                  disabled={!isDemoMode}
                  onClick={() => deleteEntry(selected)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Delete
                </button>
              </div>

              <p className="text-xs text-text-secondary">
                Demo metadata only. Changes are not written to the server.
              </p>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <File
                size={48}
                aria-hidden="true"
                className="text-text-secondary/60"
              />
              <h3 className="font-medium text-text-primary">
                {t("servers.files.noSelection", {
                  defaultValue: "No file selected",
                })}
              </h3>
              <p className="text-sm text-text-secondary">
                {t("servers.files.selectHint", {
                  defaultValue: "Select a file to view its details.",
                })}
              </p>
            </div>
          )}

          {onOpenUploads && (
            <button
              type="button"
              onClick={onOpenUploads}
              className="mt-5 w-full rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary hover:text-primary"
            >
              Open transfer panel
            </button>
          )}
        </aside>
      </div>

      {isDemoMode && (
        <FilesHistory
          items={historyItems}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => restoreHistory("undo")}
          onRedo={() => restoreHistory("redo")}
        />
      )}

      {contextMenu && menuEntry && (
        <FilesContextMenu
          menuRef={menuRef}
          position={contextMenu}
          entry={menuEntry}
          canEdit={isEditableFile(menuEntry) && !binaryFiles[menuEntry.path]}
          canDownload={canDownload(menuEntry)}
          onOpen={() => navigate(menuEntry.path)}
          onEdit={() => openEditor(menuEntry)}
          onDetails={() => { setSelectedPath(menuEntry.path); setContextMenu(null); }}
          onRename={() => openDialog("rename", menuEntry.path)}
          onMove={() => openTransferDialog("move", menuEntry)}
          onCopy={() => openTransferDialog("copy", menuEntry)}
          onDownload={() => downloadEntry(menuEntry)}
          onDelete={() => deleteEntry(menuEntry)}
        />
      )}

      {previewEntry && (
        <FilesPreview
          entry={previewEntry}
          text={Object.prototype.hasOwnProperty.call(fileContents, previewEntry.path) ? fileContents[previewEntry.path] : undefined}
          binary={binaryFiles[previewEntry.path]}
          onClose={() => setPreviewPath(null)}
          onDownload={() => downloadEntry(previewEntry)}
        />
      )}

      <FilesDialogs
        dialog={dialog}
        dialogName={dialogName}
        dialogError={dialogError}
        deleteTarget={deleteTarget}
        bulkDeletePaths={bulkDeletePaths}
        transferDialog={transferDialog}
        transferDestination={transferDestination}
        transferError={transferError}
        transferSourcePath={demoEntries.find((entry) => entry.path === transferDialog?.sourcePath)?.path ?? transferDialog?.sourcePath ?? ""}
        transferFolders={[
          { path: "/", name: t("servers.files.actions.goToRoot", { defaultValue: "Root directory (/)" }) },
          ...demoEntries.filter((entry) => entry.kind === "folder")
            .filter((entry) => !(transferDialog?.sourcePaths ?? (transferDialog ? [transferDialog.sourcePath] : [])).some((path) => isWithin(entry.path, path)))
            .map((entry) => ({ path: entry.path, name: entry.path })),
        ]}
        onCloseName={() => setDialog(null)}
        onNameChange={setDialogName}
        onClearNameError={() => setDialogError("")}
        onSubmitName={submitDialog}
        onCloseDelete={() => { setDeleteTarget(null); setBulkDeletePaths([]); }}
        onConfirmDelete={confirmDelete}
        onCloseTransfer={() => setTransferDialog(null)}
        onDestinationChange={setTransferDestination}
        onClearTransferError={() => setTransferError("")}
        onSubmitTransfer={submitTransfer}
      />

    </div>
  );
};
