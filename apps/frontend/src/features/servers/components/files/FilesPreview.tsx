import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DemoEntry } from "../../types/files.types";
import { isEditableFile, MAX_TEXT_EDITOR_BYTES } from "../../utils/files/validation";

type Props = {
  entry: DemoEntry;
  text?: string;
  binary?: Blob;
  onClose: () => void;
  onDownload: () => void;
};

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", pdf: "application/pdf",
};

export function FilesPreview({ entry, text, binary, onClose, onDownload }: Props) {
  const { t } = useTranslation();
  const extension = entry.name.toLowerCase().split(".").pop() ?? "";
  const isImage = IMAGE_EXTENSIONS.has(extension);
  const isPdf = extension === "pdf";
  const isText = isEditableFile(entry);
  const [url, setUrl] = useState<string | null>(null);
  const [loadedText, setLoadedText] = useState<string | null>(null);
  const [readError, setReadError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!binary || (!isImage && !isPdf)) {
      setUrl(null);
      return;
    }
    // Use the expected MIME type; some uploaded Blobs have application/octet-stream.
    const objectUrl = URL.createObjectURL(new Blob([binary], { type: MIME[extension] }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [binary, extension, isImage, isPdf]);

  useEffect(() => {
    let active = true;
    setLoadedText(null);
    setReadError(false);
    setLoading(false);
    if (!isText || text !== undefined || !binary || binary.size > MAX_TEXT_EDITOR_BYTES) return;
    setLoading(true);
    void binary.arrayBuffer().then((bytes) => {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (decoded.includes("\0")) throw new Error("Binary content");
      if (active) setLoadedText(decoded);
    }).catch(() => { if (active) setReadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [binary, isText, text]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const availableText = text ?? loadedText;
  const hasContent = text !== undefined || binary !== undefined;
  const unsupported = t("servers.files.preview.unavailable", { defaultValue: "Preview is not available for this file." });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={t("servers.files.preview.title", { defaultValue: "File preview" })} className="flex h-[min(85vh,850px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-text-primary">{t("servers.files.preview.title", { defaultValue: "File preview" })}: {entry.name}</h2>
            <p className="truncate text-xs text-text-secondary">{entry.path} · {binary ? `${binary.size.toLocaleString()} B` : (entry.size ?? "—")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onDownload} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-primary hover:bg-white/5"><Download size={16}/>{t("servers.files.preview.download", { defaultValue: "Download" })}</button>
            <button type="button" onClick={onClose} aria-label={t("servers.files.preview.close", { defaultValue: "Close preview" })} className="rounded-lg p-2 text-text-secondary hover:bg-white/10"><X size={20}/></button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5 text-text-secondary">
          {!hasContent ? (
            <div className="max-w-lg text-center">{t("servers.files.preview.demoMissing", { defaultValue: "This demo file has metadata only. Its original content is not available for preview." })}</div>
          ) : isImage && url ? (
            <img src={url} alt={entry.name} className="max-h-full max-w-full object-contain" />
          ) : isPdf && url ? (
            <iframe title={entry.name} src={url} className="h-full min-h-[350px] w-full rounded-lg bg-white" />
          ) : isText && (availableText !== null && availableText !== undefined) ? (
            <pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-4 font-mono text-sm text-text-primary">{availableText}</pre>
          ) : loading ? (
            <p>{t("servers.files.preview.loading", { defaultValue: "Loading preview..." })}</p>
          ) : (
            <div className="max-w-lg text-center">
              <p>{unsupported}</p>
              {(readError || (binary && binary.size > MAX_TEXT_EDITOR_BYTES)) && <p className="mt-2 text-sm">{t("servers.files.preview.binaryInfo", { defaultValue: "The file is binary, too large for text preview, or not valid UTF-8. You can download it instead." })}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
