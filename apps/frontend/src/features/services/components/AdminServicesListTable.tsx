import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AdminService } from '../api/adminServicesApi';
import { ServiceStatus } from './ServiceStatus';

export const AdminServicesListTable = ({ services, canManage }: { services: AdminService[]; canManage: boolean }) => {
  const { t } = useTranslation();
  return <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface"><table className="w-full text-left text-sm">
    <thead><tr>{['service', 'category', 'status', 'node', 'owner', 'actions'].map((key) => <th key={key} className="p-4">{t(`adminServices.columns.${key}`)}</th>)}</tr></thead>
    <tbody>{services.map((service) => <tr key={service.id} className="border-t border-border-subtle">
      <th scope="row" className="p-4"><Link className="font-semibold text-primary" to={`/admin/services/${service.id}`}>{service.name}</Link><p className="font-mono text-xs font-normal text-text-secondary">{service.id}</p></th>
      <td className="p-4">{t(`adminServices.categories.${service.category.key}`)}</td><td className="p-4"><ServiceStatus kind="installation" status={service.installStatus} /></td><td className="p-4">{service.nodeId ?? '—'}</td><td className="p-4">{service.user?.username ?? t('adminServices.unassigned')}</td>
      <td className="p-4">{canManage && service.installStatus === 'DRAFT' && <Link to={`/admin/services/${service.id}/edit`}>{t('common.edit')}</Link>}</td>
    </tr>)}</tbody>
  </table>{!services.length && <p className="p-5">{t('adminServices.empty')}</p>}</div>;
};
