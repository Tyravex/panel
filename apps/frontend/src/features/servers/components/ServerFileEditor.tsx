import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileCode2,
  RotateCcw,
  Save,
  X,
} from "lucide-react";

type Props = {
  fileName: string;
  filePath: string;
  initialContent: string;
  isDemoMode: boolean;
  onBack: () => void;
  onSave?: (content: string) => void;
};

const getLanguage = (fileName: string): string => {
  const name = fileName.toLowerCase();
  const extension = name.split(".").pop();

  if (name.startsWith(".env")) return "ini";
  if (name === "dockerfile") return "dockerfile";

  switch (extension) {
    case "json":
      return "json";
    case "yml":
    case "yaml":
      return "yaml";
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "properties":
    case "cfg":
    case "conf":
    case "config":
    case "ini":
    case "toml":
      return "ini";
    case "xml":
      return "xml";
    case "html":
      return "html";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "sh":
      return "shell";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "java":
      return "java";
    case "php":
      return "php";
    case "sql":
      return "sql";
    default:
      return "plaintext";
  }
};

const getLanguageLabel = (language: string): string => {
  const labels: Record<string, string> = {
    plaintext: "Plain Text",
    json: "JSON",
    yaml: "YAML",
    javascript: "JavaScript",
    typescript: "TypeScript",
    ini: "INI / Configuration",
    dockerfile: "Dockerfile",
    xml: "XML",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    shell: "Shell",
    markdown: "Markdown",
    python: "Python",
    java: "Java",
    php: "PHP",
    sql: "SQL",
  };

  return labels[language] ?? language;
};

export const ServerFileEditor = ({
  fileName,
  filePath,
  initialContent,
  isDemoMode,
  onBack,
  onSave,
}: Props) => {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [showSaved, setShowSaved] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({
    line: 1,
    column: 1,
  });

  const saveRef = useRef<() => void>(() => {});
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  const language = useMemo(
    () => getLanguage(fileName),
    [fileName],
  );

  const isDirty = content !== savedContent;

  const lineCount = useMemo(
    () => Math.max(1, content.split("\n").length),
    [content],
  );

  const byteSize = useMemo(
    () => new TextEncoder().encode(content).length,
    [content],
  );

  useEffect(() => {
    setContent(initialContent);
    setSavedContent(initialContent);
    setShowSaved(false);
    setShowDiscardDialog(false);
    setCursorPosition({ line: 1, column: 1 });
  }, [filePath, initialContent]);

  useEffect(() => {
    if (!showDiscardDialog) return;

    keepEditingRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowDiscardDialog(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDiscardDialog]);

  const handleSave = useCallback(() => {
    if (!isDemoMode) return;

    onSave?.(content);
    setSavedContent(content);
    setShowSaved(true);
  }, [content, isDemoMode, onSave]);

  // Monaco registers Ctrl+S once and invokes the latest save handler.
  saveRef.current = handleSave;

  const handleReset = () => {
    setContent(savedContent);
    setShowSaved(false);
  };

  const handleBack = () => {
    if (isDirty) {
      setShowDiscardDialog(true);
      return;
    }

    onBack();
  };

  const handleDiscard = () => {
    setShowDiscardDialog(false);
    onBack();
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => saveRef.current(),
    );

    editor.onDidChangeCursorPosition(
      (event: {
        position: {
          lineNumber: number;
          column: number;
        };
      }) => {
        setCursorPosition({
          line: event.position.lineNumber,
          column: event.position.column,
        });
      },
    );
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to files"
            className="rounded-lg border border-border-subtle p-2 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <FileCode2 size={20} aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-text-primary">
                  {fileName}
                </h2>

                {isDirty && (
                  <span
                    title="Unsaved changes"
                    className="size-2 shrink-0 rounded-full bg-amber-400"
                  />
                )}
              </div>

              <p className="truncate text-xs text-text-secondary">
                {filePath}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty}
            className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={15} aria-hidden="true" />
            Reset
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDemoMode || !isDirty}
            title={
              isDemoMode
                ? "Save in demo memory (Ctrl+S)"
                : "File API not connected"
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} aria-hidden="true" />
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-white/[0.02] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
          <span>{getLanguageLabel(language)}</span>
          <span>UTF-8</span>
          <span>{lineCount} lines</span>
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        </div>

        <div className="text-xs">
          {isDirty ? (
            <span className="text-amber-400">
              Unsaved changes
            </span>
          ) : showSaved ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Check size={14} aria-hidden="true" />
              Saved in demo
            </span>
          ) : (
            <span className="text-text-secondary">
              No changes
            </span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 border-b border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-5 text-text-secondary">
        <AlertCircle
          size={16}
          className="mt-0.5 shrink-0 text-primary"
          aria-hidden="true"
        />
        {isDemoMode
          ? "Demo editor. Changes are kept in memory while the file manager is open. Nothing is written to the server."
          : "File content is unavailable until the server file API is connected."}
      </div>

      <div className="h-[520px] bg-[#080d16] sm:h-[620px]">
        <Editor
          height="100%"
          path={`tyravex-demo://${filePath}`}
          language={language}
          value={content}
          theme="vs-dark"
          loading={
            <div className="flex h-full items-center justify-center bg-[#080d16] text-sm text-text-secondary">
              Loading editor...
            </div>
          }
          onMount={handleEditorMount}
          onChange={(value) => {
            setContent(value ?? "");
            setShowSaved(false);
          }}
          options={{
            readOnly: !isDemoMode,
            automaticLayout: true,
            fontFamily:
              "Consolas, 'Cascadia Code', 'Fira Code', monospace",
            fontSize: 13,
            lineHeight: 24,
            lineNumbers: "on",
            minimap: {
              enabled: true,
              maxColumn: 80,
            },
            wordWrap: "off",
            scrollBeyondLastLine: false,
            renderWhitespace: "selection",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            bracketPairColorization: {
              enabled: true,
            },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            autoIndent: "advanced",
            formatOnPaste: true,
            tabSize: 2,
            insertSpaces: true,
            padding: {
              top: 16,
              bottom: 16,
            },
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-xs text-text-secondary">
        <span className="truncate">{filePath}</span>

        <div className="flex items-center gap-3">
          <span>{byteSize.toLocaleString()} bytes</span>
          <span>Ctrl+S to save</span>
        </div>
      </div>

      {showDiscardDialog && (
        <div
          role="presentation"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowDiscardDialog(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-dialog-title"
            aria-describedby="discard-dialog-description"
            className="w-full max-w-md rounded-2xl border border-border-subtle bg-slate-900 p-6 shadow-2xl shadow-black/50"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-amber-500/10 p-3 text-amber-400">
                <AlertCircle size={22} aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  id="discard-dialog-title"
                  className="text-lg font-semibold text-text-primary"
                >
                  Discard changes?
                </h3>

                <p
                  id="discard-dialog-description"
                  className="mt-2 text-sm leading-6 text-text-secondary"
                >
                  You have unsaved changes in{" "}
                  <span className="break-all font-semibold text-text-primary">
                    {fileName}
                  </span>
                  .
                </p>

                <p className="mt-3 text-xs text-text-secondary">
                  Leaving the editor without saving will discard
                  your latest changes.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                ref={keepEditingRef}
                type="button"
                onClick={() => setShowDiscardDialog(false)}
                className="rounded-lg border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
              >
                Keep editing
              </button>

              <button
                type="button"
                onClick={handleDiscard}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500"
              >
                <X size={16} aria-hidden="true" />
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
