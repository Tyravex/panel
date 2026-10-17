import type { DemoFileEntry } from "../demo/files.demo";

export type ContextMenu = {
  path: string;
  x: number;
  y: number;
};

export type FileDialog = {
  action: "new-file" | "new-folder" | "rename";
  path?: string;
};

export type TransferDialog = {
  action: "move" | "copy";
  sourcePath: string;
  sourcePaths?: string[];
};

export type DemoEntry = DemoFileEntry;

export type UploadTransfer = {
  id: number;
  name: string;
  loaded: number;
  total: number;
  status: "reading" | "completed" | "error";
  message?: string;
};

