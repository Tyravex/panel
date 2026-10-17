import { useState } from "react";
import type { DemoEntry } from "../types/files.types";
import { isWithin } from "../utils/files/paths";

/** Selection state and range selection for the current file list. */
export const useFileSelection = (entries: DemoEntry[]) => {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);

  const selectEntry = (path: string, ctrl: boolean, shift: boolean) => {
    if (shift) {
      const anchorIndex = entries.findIndex((entry) => entry.path === selectionAnchor);
      const targetIndex = entries.findIndex((entry) => entry.path === path);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const range = entries.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1).map((entry) => entry.path);
        setSelectedPaths((previous) => ctrl ? Array.from(new Set([...previous, ...range])) : range);
      } else {
        setSelectedPaths([path]);
        setSelectionAnchor(path);
      }
    } else if (ctrl) {
      setSelectedPaths((previous) => previous.includes(path) ? previous.filter((item) => item !== path) : [...previous, path]);
      setSelectionAnchor(path);
    } else {
      setSelectedPaths([path]);
      setSelectionAnchor(path);
    }
  };

  const selectedRoots = selectedPaths.filter((path) => !selectedPaths.some((other) => other !== path && isWithin(path, other)));

  return { selectedPaths, setSelectedPaths, selectionAnchor, setSelectionAnchor, selectEntry, selectedRoots };
};
