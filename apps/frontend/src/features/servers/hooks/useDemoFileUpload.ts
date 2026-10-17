import { useEffect, useRef, useState } from "react";
import type { DemoEntry, UploadTransfer } from "../types/files.types";
import type { UploadTransfer as WidgetUploadTransfer } from "../components/ServerUploadWidget";
import { joinPath } from "../utils/files/paths";
import { formatBytes, getModified } from "../utils/files/format";
import { MAX_DEMO_FILE_BYTES, MAX_TEXT_EDITOR_BYTES, isEditableFile, isLikelyBinary, validateName } from "../utils/files/validation";
import { readDroppedFiles } from "../utils/files/drop";

type Options = {
  isDemoMode: boolean;
  directory: string;
  demoEntriesRef: { current: DemoEntry[] };
  appendUploads: (accepted: DemoEntry[], texts: Record<string, string>, binaries: Record<string, Blob>) => void;
  onOpenUploads?: () => void;
  onTransfersChange?: (transfers: WidgetUploadTransfer[]) => void;
  onUploaded: (lastPath: string) => void;
};

/** Demo-only uploads: queued reads, folder traversal and progress reporting. */
export function useDemoFileUpload({ isDemoMode, directory, demoEntriesRef, appendUploads, onOpenUploads, onTransfersChange, onUploaded }: Options) {
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadTransfers, setUploadTransfers] = useState<UploadTransfer[]>([]);
  const onTransfersChangeRef = useRef(onTransfersChange);
  onTransfersChangeRef.current = onTransfersChange;

  useEffect(() => {
    onTransfersChangeRef.current?.(uploadTransfers.map((transfer) => ({
      id: String(transfer.id),
      name: transfer.name,
      progress: transfer.total === 0
        ? (transfer.status === "completed" ? 100 : 0)
        : Math.min(100, Math.round((transfer.loaded / transfer.total) * 100)),
      state: transfer.status === "reading" ? "uploading"
        : transfer.status === "completed" ? "complete" : "error",
      detail: transfer.message ?? (transfer.status === "reading"
        ? `${formatBytes(transfer.loaded)} / ${formatBytes(transfer.total)} read locally`
        : transfer.status === "completed" ? "Read into demo memory" : "Could not read file"),
    })));
  }, [uploadTransfers]);
  const nextUploadId = useRef(0);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const updateUploadTransfer = (id: number, patch: Partial<UploadTransfer>) => {
    setUploadTransfers((previous) =>
      previous.map((transfer) =>
        transfer.id === id ? { ...transfer, ...patch } : transfer,
      ),
    );
  };

  const uploadFiles = (files: FileList | File[], relativePaths?: string[]) => {
    if (!isDemoMode) return;

    // Copy FileList immediately: clearing the input invalidates the live list.
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    onOpenUploads?.();

    const queued = incoming.map((file, index) => ({
      relativePath: relativePaths?.[index] || file.webkitRelativePath || file.name,
      file,
      id: ++nextUploadId.current,
    }));

    setUploadTransfers((previous) => [
      ...previous,
      ...queued.map(({ file, id, relativePath }): UploadTransfer => ({
        id,
        name: relativePath,
        loaded: 0,
        total: file.size,
        status: "reading",
      })),
    ]);
    setUploadError("");
    setUploadSuccess("");

    // Serialize batches so files dropped in quick succession cannot bypass
    // duplicate checks before the previous batch updates React state.
    uploadQueueRef.current = uploadQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const existingPaths = new Set(demoEntriesRef.current.map((entry) => entry.path));
        const accepted: DemoEntry[] = [];
        const texts: Record<string, string> = {};
        const binaries: Record<string, Blob> = {};
        const errors: string[] = [];

        for (const { file, id, relativePath } of queued) {
          const parts = relativePath.split("/").filter(Boolean);
          const name = parts[parts.length - 1] ?? file.name;
          const nameError = parts.map(validateName).find(Boolean) ?? null;
          const path = joinPath(directory, parts.join("/"));
          const foldersToCreate: DemoEntry[] = [];
          for (let index = 1; index < parts.length; index++) {
            const folderPath = joinPath(directory, parts.slice(0, index).join("/"));
            if (!existingPaths.has(folderPath)) {
              foldersToCreate.push({ path: folderPath, name: parts[index - 1], kind: "folder", modified: getModified() });
            }
          }
          const invalidParent = parts.slice(1).some((_, index) => {
            const parentPath = joinPath(directory, parts.slice(0, index + 1).join("/"));
            return demoEntriesRef.current.some((entry) => entry.path === parentPath && entry.kind !== "folder");
          });
          const rejection = nameError
            ?? (invalidParent ? "A parent path is a file, not a folder." : null)
            ?? (existingPaths.has(path) ? "An item with this name already exists." : null)
            ?? (file.size > MAX_DEMO_FILE_BYTES ? "Exceeds the 100 MB demo memory limit." : null);

          if (rejection) {
            errors.push(`${name}: ${rejection}`);
            updateUploadTransfer(id, { status: "error", message: rejection });
            continue;
          }

          try {
            const editable = isEditableFile({ path, name, kind: "file", modified: "" });
            const asText = editable && !isLikelyBinary(name, file.type) &&
              file.size <= MAX_TEXT_EDITOR_BYTES;
            const reader = file.stream().getReader();
            const decoder = asText ? new TextDecoder("utf-8") : null;
            let content = "";
            let loaded = 0;

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                loaded += value.byteLength;
                if (decoder) content += decoder.decode(value, { stream: true });
                updateUploadTransfer(id, { loaded });
              }
              if (decoder) content += decoder.decode();
            } finally {
              reader.releaseLock();
            }

            if (asText && !content.includes("\0")) {
              texts[path] = content;
            } else {
              // Keep the original File bytes for exact binary downloads.
              binaries[path] = file;
            }

            for (const folder of foldersToCreate) {
              if (!existingPaths.has(folder.path)) {
                accepted.push(folder);
                existingPaths.add(folder.path);
              }
            }
            accepted.push({
              path,
              name,
              kind: "file",
              size: formatBytes(file.size),
              modified: getModified(),
            });
            existingPaths.add(path);
            updateUploadTransfer(id, { status: "completed", loaded: file.size });
          } catch {
            const message = "Could not read this file.";
            errors.push(`${name}: ${message}`);
            updateUploadTransfer(id, { status: "error", message });
          }
        }

        if (accepted.length > 0) {
          appendUploads(accepted, texts, binaries);
          onUploaded(accepted[accepted.length - 1].path);
        }
        setUploadSuccess(accepted.length
          ? `${accepted.length} file${accepted.length === 1 ? "" : "s"} added to demo memory.`
          : "");
        setUploadError(errors.join("\n"));
      });
  };

  const uploadDroppedItems = async (dataTransfer: DataTransfer) => {
    try {
      const { files, paths } = await readDroppedFiles(dataTransfer);
      uploadFiles(files, paths);
    } catch {
      setUploadError("Could not read the dropped folder.");
    }
  };

  return { uploadError, setUploadError, uploadSuccess, setUploadSuccess, isDraggingFiles, setIsDraggingFiles, uploadFiles, uploadDroppedItems };
}
