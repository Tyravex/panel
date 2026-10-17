import { useRef, useState } from "react";
import { demoFileEntries } from "../demo/files.demo";
import type { DemoEntry } from "../types/files.types";
import { getModified, getFileSize } from "../utils/files/format";
import { isWithin } from "../utils/files/paths";

export type FileHistoryAction = "create" | "rename" | "move" | "copy" | "delete" | "save" | "upload";
export type FileHistoryItem = { id: number; action: FileHistoryAction; detail: string };
type Snapshot = {
  entries: DemoEntry[];
  texts: Record<string, string>;
  binaries: Record<string, Blob>;
};
type Change = { item: FileHistoryItem; before: Snapshot; after: Snapshot };
const HISTORY_LIMIT = 30;

/** Demo filesystem with in-memory, bounded undo/redo history. No server writes. */
export function useDemoFileSystem() {
  const initial = useRef<Snapshot | null>(null);
  if (!initial.current) initial.current = {
    entries: demoFileEntries.map((entry) => ({ ...entry })), texts: {}, binaries: {},
  };
  const snapshotRef = useRef<Snapshot>(initial.current);
  const [demoEntries, setDemoEntries] = useState<DemoEntry[]>(initial.current.entries);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [binaryFiles, setBinaryFiles] = useState<Record<string, Blob>>({});
  const demoEntriesRef = useRef(demoEntries);
  const [history, setHistory] = useState<Change[]>([]);
  const historyRef = useRef<Change[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const nextId = useRef(1);

  const apply = (snapshot: Snapshot) => {
    snapshotRef.current = snapshot;
    demoEntriesRef.current = snapshot.entries;
    setDemoEntries(snapshot.entries);
    setFileContents(snapshot.texts);
    setBinaryFiles(snapshot.binaries);
  };

  const commit = (action: FileHistoryAction, detail: string, after: Snapshot) => {
    const before = snapshotRef.current;
    const change: Change = {
      item: { id: nextId.current++, action, detail }, before, after,
    };
    const next = [...historyRef.current.slice(0, historyIndexRef.current), change].slice(-HISTORY_LIMIT);
    historyRef.current = next;
    historyIndexRef.current = next.length;
    setHistory(next);
    setHistoryIndex(next.length);
    apply(after);
  };

  const undo = (): boolean => {
    if (historyIndexRef.current === 0) return false;
    const next = historyIndexRef.current - 1;
    apply(historyRef.current[next].before);
    historyIndexRef.current = next;
    setHistoryIndex(next);
    return true;
  };
  const redo = (): boolean => {
    if (historyIndexRef.current >= historyRef.current.length) return false;
    const next = historyIndexRef.current;
    apply(historyRef.current[next].after);
    historyIndexRef.current = next + 1;
    setHistoryIndex(next + 1);
    return true;
  };

  const createEntry = (path: string, name: string, kind: DemoEntry["kind"]) => {
    const current = snapshotRef.current;
    const entry: DemoEntry = { path, name, kind, modified: getModified(), ...(kind === "file" ? { size: "0 B" } : {}) };
    commit("create", path, {
      entries: [...current.entries, entry],
      texts: kind === "file" ? { ...current.texts, [path]: "" } : current.texts,
      binaries: current.binaries,
    });
  };

  const renameEntry = (oldPath: string, newPath: string, name: string) => {
    const current = snapshotRef.current;
    const remap = (path: string) => isWithin(path, oldPath) ? newPath + path.slice(oldPath.length) : path;
    const entries = current.entries.map((entry) => isWithin(entry.path, oldPath)
      ? { ...entry, path: remap(entry.path), name: entry.path === oldPath ? name : entry.name,
          modified: entry.path === oldPath ? getModified() : entry.modified }
      : entry);
    const remapMap = <T,>(map: Record<string, T>): Record<string, T> => Object.fromEntries(
      Object.entries(map).map(([path, value]) => [remap(path), value]),
    );
    commit("rename", `${oldPath} → ${newPath}`, { entries, texts: remapMap(current.texts), binaries: remapMap(current.binaries) });
  };

  const transferEntries = (mapping: { oldPath: string; newPath: string }[], action: "move" | "copy") => {
    const current = snapshotRef.current;
    const belongs = (path: string) => mapping.some(({ oldPath }) => isWithin(path, oldPath));
    const remap = (path: string) => {
      const match = mapping.find(({ oldPath }) => isWithin(path, oldPath));
      return match ? match.newPath + path.slice(match.oldPath.length) : path;
    };
    const affected = current.entries.filter((entry) => belongs(entry.path));
    const updated = affected.map((entry) => ({ ...entry, path: remap(entry.path), modified: getModified() }));
    const entries = action === "copy" ? [...current.entries, ...updated]
      : [...current.entries.filter((entry) => !belongs(entry.path)), ...updated];
    const updateMap = <T,>(previous: Record<string, T>): Record<string, T> => {
      const result: Record<string, T> = action === "copy" ? { ...previous } : {};
      for (const [path, value] of Object.entries(previous)) {
        if (action === "move" || belongs(path)) result[remap(path)] = value;
      }
      return result;
    };
    commit(action, mapping.map((item) => item.oldPath).join(", "), {
      entries, texts: updateMap(current.texts), binaries: updateMap(current.binaries),
    });
  };

  const removeEntries = (paths: string[]) => {
    const current = snapshotRef.current;
    const shouldDelete = (path: string) => paths.some((root) => isWithin(path, root));
    commit("delete", paths.join(", "), {
      entries: current.entries.filter((entry) => !shouldDelete(entry.path)),
      texts: Object.fromEntries(Object.entries(current.texts).filter(([path]) => !shouldDelete(path))),
      binaries: Object.fromEntries(Object.entries(current.binaries).filter(([path]) => !shouldDelete(path))),
    });
  };

  const saveContent = (path: string, content: string) => {
    const current = snapshotRef.current;
    if (current.texts[path] === content) return;
    commit("save", path, {
      entries: current.entries.map((entry) => entry.path === path
        ? { ...entry, size: getFileSize(content), modified: getModified() } : entry),
      texts: { ...current.texts, [path]: content }, binaries: current.binaries,
    });
  };

  const appendUploads = (accepted: DemoEntry[], texts: Record<string, string>, binaries: Record<string, Blob>) => {
    if (accepted.length === 0) return;
    const current = snapshotRef.current;
    commit("upload", accepted.map((entry) => entry.path).join(", "), {
      entries: [...current.entries, ...accepted],
      texts: { ...current.texts, ...texts }, binaries: { ...current.binaries, ...binaries },
    });
  };

  return {
    demoEntries, demoEntriesRef, fileContents, binaryFiles,
    createEntry, renameEntry, transferEntries, removeEntries, saveContent, appendUploads,
    undo, redo, canUndo: historyIndex > 0, canRedo: historyIndex < history.length,
    historyItems: history.map((change, index) => ({ ...change.item, applied: index < historyIndex })),
  };
}
