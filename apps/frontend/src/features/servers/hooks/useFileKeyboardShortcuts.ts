import { useEffect } from "react";
import type { RefObject } from "react";

type ShortcutActions = {
  selectAll: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  remove: () => void;
  rename: () => void;
};

/** Keyboard shortcuts only apply while focus is inside the file manager. */
export function useFileKeyboardShortcuts(
  containerRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  actions: ShortcutActions,
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      const target = event.target;
      if (!container || !(target instanceof Node) || !container.contains(target)) return;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], .monaco-editor')) return;
      if (event.altKey || event.isComposing || event.repeat) return;

      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (command && !event.shiftKey && key === "a") {
        event.preventDefault(); actions.selectAll();
      } else if (command && !event.shiftKey && key === "c") {
        event.preventDefault(); actions.copy();
      } else if (command && !event.shiftKey && key === "x") {
        event.preventDefault(); actions.cut();
      } else if (command && !event.shiftKey && key === "v") {
        event.preventDefault(); actions.paste();
      } else if (!command && !event.shiftKey && key === "delete") {
        event.preventDefault(); actions.remove();
      } else if (!command && !event.shiftKey && key === "f2") {
        event.preventDefault(); actions.rename();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, enabled, actions]);
}
