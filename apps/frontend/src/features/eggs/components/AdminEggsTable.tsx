import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { EggCatalogItem } from '@shared/types';
import { EggTagBadge } from './EggTagBadge';

export const AdminEggsTable = ({ items, canManage = false }: { items: EggCatalogItem[]; canManage?: boolean }) => {
  const { t } = useTranslation();
  return <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface"><table className="w-full text-left text-sm">
    <thead><tr>{['name', 'categoryAndTags', 'version', 'source', 'approval', 'availability', 'actions'].map((key) => <th key={key} className="p-4 font-medium text-text-secondary">{t(`eggs.${key}`)}</th>)}</tr></thead>
    <tbody>{items.map((egg) => <tr className="border-t border-border-subtle hover:bg-white/[0.02]" key={egg.id}>
      <th scope="row" className="max-w-sm p-4 font-normal"><Link className="font-semibold text-primary" to={`/admin/eggs/${egg.id}`}>{egg.name}</Link>
        <p className="mt-1 text-sm text-text-secondary">{egg.description}</p><p className="mt-1 font-mono text-xs text-text-secondary">{egg.key}</p>
      </th>
      <td className="p-4"><p className="mb-2">{t(`adminServices.categories.${egg.category}`, { defaultValue: egg.category })}</p><div className="flex max-w-xs flex-wrap gap-1.5">{egg.tags.map((tag) => <EggTagBadge key={tag.id} tag={tag} />)}</div></td>
      <td className="whitespace-nowrap p-4 align-top"><span className="font-mono font-medium">v{egg.version}</span>{egg.latestVersion && <p className="mt-1 text-xs text-amber-300">{t('eggs.updateAvailable', { version: egg.latestVersion })}</p>}</td>
      <td className="p-4"><p>{egg.repository.name}</p>{egg.repository.isOfficial && <span className="mt-1 inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-xs text-blue-300">{t('eggs.officialRepository')}</span>}</td>
      <td className="p-4">{t(`eggs.status.${egg.approvalStatus}`)}</td><td className="p-4"><p>{t(egg.isEnabled ? 'eggs.enabled' : 'eggs.disabled')}</p><p className="mt-1 text-xs text-text-secondary">{t('eggs.usedByServices', { count: egg.serviceCount })}</p></td>
      <td className="p-4"><div className="flex flex-col gap-2"><Link className="text-primary" to={`/admin/eggs/${egg.id}`}>{t('eggs.details')}</Link>{canManage && <Link to={`/admin/eggs/${egg.id}/edit`}>{t('eggs.edit')}</Link>}</div></td>
    </tr>)}</tbody>
  </table>{!items.length && <p className="p-6 text-text-secondary">{t('eggs.empty')}</p>}</div>;
};
