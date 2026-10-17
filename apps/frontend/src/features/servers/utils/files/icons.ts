import { File, FileArchive, FileCog, FileImage, Folder } from "lucide-react";
import type { DemoEntry } from "../../types/files.types";

export const getEntryIcon = (entry: DemoEntry, binaryFiles: Record<string, Blob>) => {
  if (entry.kind === "folder") return Folder;
  if (!binaryFiles[entry.path]) return File;
  const extension = entry.name.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico"].includes(extension)) return FileImage;
  if (["zip", "rar", "7z", "tar", "gz", "jar", "war"].includes(extension)) return FileArchive;
  return FileCog;
};

