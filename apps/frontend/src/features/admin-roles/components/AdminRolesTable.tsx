import { Fragment, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import type { AdminRole } from '../api/adminRolesApi';
import { groupRolePermissions } from '../lib/groupRolePermissions';
import { RolePermissionDetails } from './RolePermissionDetails';

interface AdminRolesTableProps {
  roles: AdminRole[];
  total: number;
  loading: boolean;
  canManage: boolean;
  saving: boolean;
  onDelete: (role: AdminRole) => void;
}

export const AdminRolesTable = ({ roles, total, loading, canManage, saving, onDelete }: AdminRolesTableProps) => {
  const { t } = useTranslation();
  const id = useId();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  if (loading) return <p role="status" className="p-5 text-text-secondary">{t('adminRoles.list.loading')}</p>;
  if (!roles.length) return <p role="status" className="rounded-xl border border-border-subtle p-5 text-text-secondary">
    {t(total ? 'adminRoles.list.noMatches' : 'adminRoles.list.noRoles')}
  </p>;
  return <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{t('adminRoles.existingRoles')}</caption>
      <thead><tr className="border-b border-border-subtle text-text-secondary">
        <th scope="col" className="p-4">{t('adminRoles.roleName')}</th>
        <th scope="col" className="p-4">{t('adminRoles.list.modules')}</th>
        <th scope="col" className="p-4 text-center">{t('adminRoles.list.permissions')}</th>
        <th scope="col" className="p-4 text-center">{t('adminRoles.list.users')}</th>
        <th scope="col" className="p-4">{t('adminRoles.list.actions')}</th>
      </tr></thead>
      <tbody>{roles.map((role) => {
        const owner = role.name.toLowerCase() === 'owner';
        const open = expanded.has(role.id);
        const detailsId = `${id}-${encodeURIComponent(role.id)}`;
        const blocked = owner ? 'adminRoles.list.ownerProtected'
          : role._count.users > 0 ? 'adminRoles.unassignUsersFirst' : null;
        return <Fragment key={role.id}>
          <tr className="border-b border-border-subtle last:border-0">
            <th scope="row" className="min-w-44 p-4 font-medium">
              <span className="block">{role.name}</span>
              {owner && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                <ShieldCheck size={13} aria-hidden="true" />{t('adminRoles.list.protected')}
              </span>}
            </th>
            <td className="min-w-48 p-4"><div className="flex flex-wrap gap-1.5">
              {groupRolePermissions(role.permissions).map((group) => <span key={group.id}
                className="rounded-full border border-border-subtle px-2 py-1 text-xs text-text-secondary">
                {t(`adminRoles.permissionGroups.${group.id}`)}
              </span>)}
              {!role.permissions.length && <span className="text-text-secondary">{t('adminRoles.noPermissions')}</span>}
            </div></td>
            <td className="p-4 text-center">
              {role.permissions.length > 0 ? <button type="button" aria-expanded={open} aria-controls={detailsId}
                aria-label={t(open ? 'adminRoles.list.hidePermissions' : 'adminRoles.list.showPermissions', { role: role.name })}
                onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(role.id)) next.delete(role.id); else next.add(role.id);
                  return next;
                })} className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 hover:bg-white/5">
                {open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                {role.permissions.length}
              </button> : 0}
            </td>
            <td className="p-4 text-center tabular-nums">{role._count.users}</td>
            <td className="min-w-48 p-4">
              {canManage ? <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {!owner && <Link to={`/admin/roles/${encodeURIComponent(role.id)}/edit`}
                    className="rounded-lg border border-border-subtle px-3 py-1.5 hover:bg-white/5">{t('common.edit')}</Link>}
                  <button type="button" disabled={saving || !!blocked} title={blocked ? t(blocked) : t('adminRoles.deleteRole')}
                    onClick={() => { if (!blocked && !saving) onDelete(role); }}
                    className="rounded-lg border border-red-500/30 px-3 py-1.5 text-red-300 hover:bg-red-500/10 disabled:opacity-40">
                    {t('common.delete')}
                  </button>
                </div>
                {blocked && <p className="max-w-64 text-xs text-text-secondary">{t(blocked)}</p>}
              </div> : <span className="text-text-secondary">—</span>}
            </td>
          </tr>
          {open && <tr id={detailsId} className="border-b border-border-subtle bg-primary/[0.025] last:border-0">
            <td colSpan={5} className="p-5"><RolePermissionDetails permissions={role.permissions} /></td>
          </tr>}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
};
