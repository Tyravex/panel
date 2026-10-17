import JSZip from "jszip";
import type { DemoEntry } from "../../types/files.types";
import { getModified, formatBytes } from "./format";
import { isWithin, joinPath } from "./paths";
import { isEditableFile, MAX_TEXT_EDITOR_BYTES } from "./validation";

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 1000;

type ArchiveInput = {
  entries: DemoEntry[];
  texts: Record<string, string>;
  binaries: Record<string, Blob>;
};

export type ExtractedArchive = {
  entries: DemoEntry[];
  texts: Record<string, string>;
  binaries: Record<string, Blob>;
};

const sizeOf = (value: string | Blob): number =>
  typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.size;

const getContent = (path: string, input: ArchiveInput): string | Blob => {
  if (Object.prototype.hasOwnProperty.call(input.binaries, path)) return input.binaries[path];
  if (Object.prototype.hasOwnProperty.call(input.texts, path)) return input.texts[path];
  // Seeded demo entries can contain metadata without stored file bytes.
  // Make the fallback explicit instead of pretending to have the original content.
  return `Demo placeholder for ${path}\nOriginal file contents are not available in demo mode.\n`;
};

export async function createZip(roots: string[], input: ArchiveInput): Promise<Blob> {
  const zip = new JSZip();
  const chosen = input.entries.filter((entry) => roots.some((root) => isWithin(entry.path, root)));
  if (chosen.length > MAX_FILES) throw new Error("Archive contains too many items (maximum 1000).");
  let total = 0;
  for (const entry of chosen) {
    const root = roots.find((path) => isWithin(entry.path, path));
    if (!root) continue;
    const name = root.split("/").pop() ?? "";
    const relative = name + entry.path.slice(root.length);
    if (entry.kind === "folder") {
      zip.folder(relative);
    } else {
      const content = getContent(entry.path, input);
      total += sizeOf(content);
      if (total > MAX_EXTRACTED_BYTES) throw new Error("Archive contents exceed the 200 MB limit.");
      zip.file(relative, typeof content === "string" ? content : await content.arrayBuffer());
    }
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 5 } });
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error("ZIP exceeds the 100 MB archive limit.");
  return new Blob([bytes as BlobPart], { type: "application/zip" });
}

export async function extractZip(blob: Blob, destination: string, existing: DemoEntry[]): Promise<ExtractedArchive> {
  if (blob.size > MAX_ARCHIVE_BYTES) throw new Error("ZIP exceeds the 100 MB archive limit.");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
  const items = Object.values(zip.files);
  if (items.length > MAX_FILES) throw new Error("Archive contains too many items (maximum 1000).");
  const paths = new Set(existing.map((entry) => entry.path));
  const existingFiles = new Set(existing.filter((entry) => entry.kind === "file").map((entry) => entry.path));
  const pending = new Map<string, DemoEntry>();
  const texts: Record<string, string> = {};
  const binaries: Record<string, Blob> = {};
  let total = 0;
  const addFolder = (path: string) => {
    if (path === "/" || path === destination) return;
    if (existingFiles.has(path)) throw new Error(`A file blocks the destination folder: ${path}`);
    if (pending.has(path)) {
      if (pending.get(path)?.kind !== "folder") throw new Error(`A file blocks the destination folder: ${path}`);
      return;
    }
    if (paths.has(path)) return;
    const parent = path.substring(0, path.lastIndexOf("/")) || "/";
    addFolder(parent);
    pending.set(path, { path, name: path.split("/").pop() ?? "", kind: "folder", modified: getModified() });
  };
  for (const item of items) {
    const raw = item.name.replace(/\\/g, "/");
    const parts = raw.split("/").filter(Boolean);
    if (!parts.length) continue;
    if (raw.startsWith("/") || /^[a-zA-Z]:/.test(raw) || parts.some((part) => part === "." || part === ".." || part.includes("\0"))) {
      throw new Error("ZIP contains an unsafe path.");
    }
    const target = parts.reduce((parent, part) => joinPath(parent, part), destination);
    if ((destination !== "/" && !isWithin(target, destination)) || target === destination || !target.startsWith("/")) {
      throw new Error("ZIP contains an unsafe path.");
    }
    if (item.dir) {
      if (paths.has(target) || (pending.has(target) && pending.get(target)?.kind !== "folder")) throw new Error(`An item already exists: ${target}`);
      addFolder(target);
      continue;
    }
    if (paths.has(target) || pending.has(target)) throw new Error(`An item already exists: ${target}`);
    const parent = target.substring(0, target.lastIndexOf("/")) || "/";
    addFolder(parent);
    const data = await item.async("uint8array");
    total += data.byteLength;
    if (total > MAX_EXTRACTED_BYTES) throw new Error("Extracted data exceeds the 200 MB limit.");
    const entry: DemoEntry = {
      path: target,
      name: parts[parts.length - 1],
      kind: "file",
      modified: getModified(),
      size: formatBytes(data.byteLength),
    };

    // Store supported UTF-8 text files as text, so Monaco can edit them.
    // Preserve binary files (and oversized text files) as Blobs.
    let decodedText: string | null = null;
    if (isEditableFile(entry) && data.byteLength <= MAX_TEXT_EDITOR_BYTES) {
      try {
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(data);
        // A NUL character is a strong indication of binary content.
        if (!decoded.includes("\0")) decodedText = decoded;
      } catch {
        // Invalid UTF-8 must remain binary to avoid corrupting file content.
      }
    }

    if (decodedText !== null) {
      texts[target] = decodedText;
    } else {
      const copy = new Uint8Array(data);
      binaries[target] = new Blob([copy.buffer as ArrayBuffer], { type: "application/octet-stream" });
    }
    pending.set(target, entry);
  }
  return { entries: [...pending.values()], texts, binaries };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
