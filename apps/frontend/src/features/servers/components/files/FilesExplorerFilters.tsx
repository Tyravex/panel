import { useTranslation } from "react-i18next";
import type { ExplorerOptions, ExplorerOrder, ExplorerScope, ExplorerSort, ExplorerType } from "../../utils/files/explorer";

type Props = {
  options: ExplorerOptions;
  onChange: (patch: Partial<ExplorerOptions>) => void;
  count: number;
  onReset: () => void;
};
export const FilesExplorerFilters = ({ options, onChange, count, onReset }: Props) => {
  const { t } = useTranslation();
  const tr = (key: string, fallback: string) => t(`servers.files.explorer.${key}`, { defaultValue: fallback });
  const control = "rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary";
  return (
    <div className="space-y-3 border-b border-border-subtle px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-text-secondary" htmlFor="explorer-scope">{tr("scope", "Search scope")}</label>
        <select id="explorer-scope" className={control} value={options.scope} onChange={(e) => onChange({ scope: e.target.value as ExplorerScope })}>
          <option value="current">{tr("current", "Current folder")}</option>
          <option value="recursive">{tr("recursive", "Current folder and subfolders")}</option>
          <option value="all">{tr("allFolders", "All folders")}</option>
        </select>
        <label className="text-xs text-text-secondary" htmlFor="explorer-type">{tr("type", "Type")}</label>
        <select id="explorer-type" className={control} value={options.type} onChange={(e) => onChange({ type: e.target.value as ExplorerType })}>
          {(["all", "folder", "text", "image", "document", "archive", "other"] as const).map((type) => <option key={type} value={type}>{tr(`type_${type}`, type)}</option>)}
        </select>
        <label className="text-xs text-text-secondary" htmlFor="explorer-sort">{tr("sort", "Sort by")}</label>
        <select id="explorer-sort" className={control} value={options.sort} onChange={(e) => onChange({ sort: e.target.value as ExplorerSort })}>
          {(["name", "size", "modified", "type", "path"] as const).map((sort) => <option key={sort} value={sort}>{tr(`sort_${sort}`, sort)}</option>)}
        </select>
        <button type="button" className={control} onClick={() => onChange({ order: options.order === "asc" ? "desc" : "asc" as ExplorerOrder })} aria-label={tr("toggleOrder", "Toggle sort order")} title={tr("toggleOrder", "Toggle sort order")}>{options.order === "asc" ? "↑ A–Z" : "↓ Z–A"}</button>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary">
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={options.showHidden} onChange={(e) => onChange({ showHidden: e.target.checked })}/>{tr("hidden", "Show hidden files")}</label>
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={options.favoritesOnly} onChange={(e) => onChange({ favoritesOnly: e.target.checked })}/>{tr("favoritesOnly", "Favorites only")}</label>
        <span aria-live="polite">{tr("results", "Results")}: {count}</span>
        <button type="button" className="ml-auto underline hover:text-text-primary" onClick={onReset}>{tr("reset", "Reset filters")}</button>
      </div>
    </div>
  );
};
