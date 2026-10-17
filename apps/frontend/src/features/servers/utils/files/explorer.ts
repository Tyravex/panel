import type { DemoEntry } from "../../types/files.types";
import { getParent } from "./paths";

export type ExplorerScope = "current" | "recursive" | "all";
export type ExplorerType = "all" | "folder" | "text" | "image" | "document" | "archive" | "other";
export type ExplorerSort = "name" | "size" | "modified" | "type" | "path";
export type ExplorerOrder = "asc" | "desc";
export type ExplorerOptions = {
  directory: string;
  query: string;
  scope: ExplorerScope;
  type: ExplorerType;
  sort: ExplorerSort;
  order: ExplorerOrder;
  showHidden: boolean;
  favoritesOnly: boolean;
  favorites: readonly string[];
};
const image = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"]);
const document = new Set(["pdf", "doc", "docx", "odt", "xls", "xlsx", "ppt", "pptx"]);
const archive = new Set(["zip", "tar", "gz", "rar", "7z", "bz2"]);
const text = new Set(["txt", "json", "yaml", "yml", "xml", "log", "md", "csv", "ts", "tsx", "js", "jsx", "css", "html", "htm", "cfg", "conf", "ini", "properties", "sh", "bat", "ps1", "py", "java", "sql", "toml", "env"]);
export const entryType = (entry: DemoEntry): ExplorerType => {
  if (entry.kind === "folder") return "folder";
  const extension = entry.name.includes(".") ? entry.name.split(".").pop()!.toLowerCase() : "";
  if (image.has(extension)) return "image";
  if (document.has(extension)) return "document";
  if (archive.has(extension)) return "archive";
  if (text.has(extension) || entry.name.startsWith(".env")) return "text";
  return "other";
};
const parseSize = (size?: string): number => {
  if (!size) return -1;
  const match = size.replace(",", ".").trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return -1;
  return Number(match[1]) * (1024 ** ({ B: 0, KB: 1, MB: 2, GB: 3, TB: 4 }[match[2]?.toUpperCase() as "B" | "KB" | "MB" | "GB" | "TB"] ?? 0));
};
const timestamp = (value?: string): number => {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
};
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
export const filterExplorerEntries = (entries: readonly DemoEntry[], options: ExplorerOptions): DemoEntry[] => {
  const query = options.query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const parent = getParent(entry.path);
    if (options.scope === "current" && parent !== options.directory) return false;
    if (options.scope === "recursive" && options.directory !== "/" && parent !== options.directory && !parent.startsWith(`${options.directory}/`)) return false;
    if (!options.showHidden && entry.path.split("/").some((part) => part.startsWith(".") && part.length > 1)) return false;
    if (options.favoritesOnly && !options.favorites.includes(entry.path)) return false;
    if (options.type !== "all" && entryType(entry) !== options.type) return false;
    return !query || entry.name.toLocaleLowerCase().includes(query) || (options.scope !== "current" && entry.path.toLocaleLowerCase().includes(query));
  }).sort((a, b) => {
    let result = 0;
    switch (options.sort) {
      case "size": result = parseSize(a.size) - parseSize(b.size); break;
      case "modified": result = timestamp(a.modified) - timestamp(b.modified); break;
      case "type": result = collator.compare(entryType(a), entryType(b)); break;
      case "path": result = collator.compare(a.path, b.path); break;
      default: result = collator.compare(a.name, b.name);
    }
    if (!result) result = collator.compare(a.path, b.path);
    return options.order === "desc" ? -result : result;
  });
};
