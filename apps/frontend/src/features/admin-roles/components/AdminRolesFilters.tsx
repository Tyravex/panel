import { useTranslation } from 'react-i18next';

interface AdminRolesFiltersProps {
  query: string;
  module: string;
  modules: string[];
  onQueryChange: (value: string) => void;
  onModuleChange: (value: string) => void;
}

export const AdminRolesFilters = ({ query, module, modules, onQueryChange, onModuleChange }: AdminRolesFiltersProps) => {
  const { t } = useTranslation();
  return <div className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-5 sm:flex-row sm:items-end">
    <label className="flex-1 space-y-2 text-sm">
      <span className="block font-medium">{t('adminRoles.list.search')}</span>
      <input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t('adminRoles.list.searchPlaceholder')}
        className="w-full rounded-xl border border-border-subtle bg-transparent px-4 py-2.5" />
    </label>
    <label className="space-y-2 text-sm">
      <span className="block font-medium">{t('adminRoles.compare.module')}</span>
      <select value={module} onChange={(event) => onModuleChange(event.target.value)}
        className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-2.5 sm:min-w-48">
        <option value="all">{t('adminRoles.compare.allModules')}</option>
        {modules.map((id) => <option key={id} value={id}>{t(`adminRoles.permissionGroups.${id}`)}</option>)}
      </select>
    </label>
    <button type="button" disabled={!query && module === 'all'}
      onClick={() => { onQueryChange(''); onModuleChange('all'); }}
      className="rounded-xl border border-border-subtle px-4 py-2.5 text-sm disabled:opacity-40">
      {t('adminRoles.list.clearFilters')}
    </button>
  </div>;
};
