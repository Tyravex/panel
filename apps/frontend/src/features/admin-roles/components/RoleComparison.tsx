import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Minus } from 'lucide-react';
import type { AdminRole, RolePermission } from '../api/adminRolesApi';
import { groupRolePermissions, isCatalogPermission, permissionTranslationKey } from '../lib/groupRolePermissions';
import { comparisonPermissions, permissionDiffers } from '../lib/compareRolePermissions';
import { PermissionInfo } from './PermissionInfo';

export const RoleComparison = ({ roles, permissions }: { roles: AdminRole[]; permissions: RolePermission[] }) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [module, setModule] = useState('all');
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const selected = selectedIds.flatMap((id) => roles.find((role) => role.id === id) ?? []);
  const availableGroups = groupRolePermissions(comparisonPermissions(roles, permissions));
  const groups = groupRolePermissions(comparisonPermissions(selected, permissions));
  const visibleGroups = groups
    .filter((group) => module === 'all' || group.id === module)
    .map((group) => ({
      ...group, permissions: group.permissions.filter((permission) =>
        !differencesOnly || permissionDiffers(selected, permission.name))
    }))
    .filter((group) => group.permissions.length > 0);

  return <div className="space-y-6">
    <section className="rounded-2xl border border-border-subtle bg-surface p-5">
      <fieldset className="space-y-3">
        <legend className="font-semibold">{t('adminRoles.compare.selectRoles')}</legend>
        <p className="text-sm text-text-secondary">{t('adminRoles.compare.selectionHint')}</p>
        {roles.length === 0 && <p>{t('adminRoles.compare.noRoles')}</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => <label key={role.id}
            className="flex items-center gap-3 rounded-xl border border-border-subtle p-3 text-sm has-[:disabled]:opacity-50">
            <input type="checkbox" checked={selectedIds.includes(role.id)}
              disabled={selectedIds.length >= 3 && !selectedIds.includes(role.id)}
              onChange={(event) => {
                const checked = event.target.checked;
                setSelectedIds((current) => checked
                  ? current.length < 3 && !current.includes(role.id) ? [...current, role.id] : current
                  : current.filter((id) => id !== role.id));
              }} className="accent-violet-500" />
            {role.name}
          </label>)}
        </div>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-border-subtle pt-5">
        <label className="space-y-2 text-sm">
          <span className="block font-medium">{t('adminRoles.compare.module')}</span>
          <select value={module} onChange={(event) => setModule(event.target.value)}
            className="rounded-xl border border-border-subtle bg-surface px-4 py-2">
            <option value="all">{t('adminRoles.compare.allModules')}</option>
            {availableGroups.map((group) => <option key={group.id} value={group.id}>{t(`adminRoles.permissionGroups.${group.id}`)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 py-2 text-sm">
          <input type="checkbox" checked={differencesOnly} onChange={(event) => setDifferencesOnly(event.target.checked)}
            className="accent-violet-500" />{t('adminRoles.compare.differencesOnly')}
        </label>
      </div>
    </section>

    {selected.length < 2 ? <p role="status" className="rounded-xl border border-border-subtle p-5 text-text-secondary">
      {t('adminRoles.compare.chooseAtLeastTwo')}
    </p> : <>
      <p className="text-sm text-text-secondary">{t('adminRoles.compare.scopeNote')}</p>
      {visibleGroups.length === 0 && <p role="status" className="rounded-xl border border-border-subtle p-5">
        {t(differencesOnly ? 'adminRoles.compare.noDifferences' : 'adminRoles.compare.noPermissions')}
      </p>}
      {visibleGroups.map((group) => <section key={group.id} className="space-y-3">
        <h2 className="text-lg font-semibold">{t(`adminRoles.permissionGroups.${group.id}`)}</h2>
        <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t('adminRoles.compare.title')} — {t(`adminRoles.permissionGroups.${group.id}`)}</caption>
            <thead><tr className="border-b border-border-subtle">
              <th scope="col" className="min-w-56 p-4">{t('adminRoles.permission')}</th>
              {selected.map((role) => <th key={role.id} scope="col" className="min-w-32 p-4 text-center">{role.name}</th>)}
            </tr></thead>
            <tbody>{group.permissions.map((permission) => {
              const key = permissionTranslationKey(permission.name);
              const label = isCatalogPermission(permission.name) ? t(`adminRoles.permissionLabels.${key}`) : permission.name;
              const description = isCatalogPermission(permission.name)
                ? t(`adminRoles.permissionDescriptions.${key}`) : t('adminRoles.unknownPermissionDescription');
              return <tr key={permission.id} className={permissionDiffers(selected, permission.name)
                ? 'border-b border-border-subtle bg-primary/5 last:border-0' : 'border-b border-border-subtle last:border-0'}>
                <th scope="row" className="p-4 font-normal">
                  <div className="flex items-start justify-between gap-2">
                    <span><span className="block font-medium">{label}</span>
                      {isCatalogPermission(permission.name) && <span className="mt-1 block break-all font-mono text-xs text-text-secondary">{permission.name}</span>}</span>
                    <PermissionInfo label={t('adminRoles.permissionInfo', { permission: label })} description={description} />
                  </div>
                </th>
                {selected.map((role) => {
                  const granted = role.permissions.some((item) => item.name === permission.name);
                  return <td key={role.id} className="p-4 text-center">
                    <span className={`inline-flex items-center gap-2 ${granted ? 'text-emerald-400' : 'text-text-secondary'}`}>
                      {granted ? <Check size={16} aria-hidden="true" /> : <Minus size={16} aria-hidden="true" />}
                      {t(granted ? 'adminRoles.compare.granted' : 'adminRoles.compare.notGranted')}
                    </span>
                  </td>;
                })}
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>)}
    </>}
  </div>;
};
