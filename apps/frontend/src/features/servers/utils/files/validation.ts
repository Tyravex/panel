import type { DemoEntry } from "../../types/files.types";

export const MAX_TEXT_EDITOR_BYTES = 10 * 1024 * 1024;
export const MAX_DEMO_FILE_BYTES = 100 * 1024 * 1024;

const MENU_WIDTH = 208;
const MENU_HEIGHT = 350;
const MENU_MARGIN = 12;

const EDITABLE_EXTENSIONS = new Set([
  "txt", "log", "json", "yml", "yaml", "toml",
  "properties", "cfg", "conf", "config", "ini",
  "xml", "js", "ts", "jsx", "tsx", "html",
  "css", "scss", "md", "sh", "bat", "ps1",
  "py", "java", "php", "sql", "env",
]);

export const isEditableFile = (entry: DemoEntry): boolean => {
  if (entry.kind !== "file") return false;

  const name = entry.name.toLowerCase();
  const extension = name.split(".").pop() ?? "";

  return (
    EDITABLE_EXTENSIONS.has(extension) ||
    name.startsWith(".env") ||
    name === "dockerfile" ||
    name === ".gitignore"
  );
};

export const isLikelyBinary = (name: string, mime: string): boolean => {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  const binaryExtensions = new Set([
    "zip", "rar", "7z", "tar", "gz", "jar", "war", "png", "jpg", "jpeg",
    "gif", "webp", "bmp", "ico", "pdf", "mp3", "mp4", "ogg", "wav",
    "mov", "webm", "exe", "dll", "so", "bin", "dat", "db", "sqlite",
    "woff", "woff2", "ttf", "otf", "class", "pyc", "wasm",
  ]);
  return binaryExtensions.has(extension) ||
    (mime !== "" && !mime.startsWith("text/") &&
      !["application/json", "application/xml", "application/javascript", "application/x-yaml"].includes(mime));
};


export const validateName = (name: string): string | null => {
  if (!name || name === "." || name === "..") {
    return "Enter a valid name.";
  }

  if (
    name.includes("/") ||
    name.includes("\\") ||
    /[\x00-\x1F\x7F]/.test(name)
  ) {
    return "Names cannot contain slashes or control characters.";
  }

  return null;
};

