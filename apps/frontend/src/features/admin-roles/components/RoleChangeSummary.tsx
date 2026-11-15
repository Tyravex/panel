import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import type { RoleChanges } from '../lib/roleChanges';
import { RolePermissionDetails } from './RolePermissionDetails';

interface RoleChangeSummaryProps {
  open: boolean;
  changes: RoleChanges | null;
  usersCount: number;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RoleChangeSummary = ({ open, changes, usersCount, saving, onConfirm, onCancel }: RoleChangeSummaryProps) => {
  const { t } = useTranslation();
  return <ConfirmDialog open={open} title={t('adminRoles.review.title')}
    confirmLabel={t('adminRoles.review.confirm')} busy={saving} onConfirm={onConfirm} onCancel={onCancel}
    description={changes && <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-2">
      <p>{t('adminRoles.review.users', { count: usersCount })}</p>
      <p className="text-xs">{t('adminRoles.review.scopeNote')}</p>
      {changes.previousName !== changes.nextName && <section className="space-y-2">
        <h3 className="font-semibold text-text-primary">{t('adminRoles.review.rename')}</h3>
        <p className="break-words">{changes.previousName} → {changes.nextName}</p>
      </section>}
      <section className="space-y-3">
        <h3 className="font-semibold text-emerald-400">{t('adminRoles.review.added', { count: changes.added.length })}</h3>
        {changes.added.length ? <RolePermissionDetails compact permissions={changes.added} /> : <p>{t('adminRoles.review.none')}</p>}
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold text-red-300">{t('adminRoles.review.removed', { count: changes.removed.length })}</h3>
        {changes.removed.length ? <RolePermissionDetails compact permissions={changes.removed} /> : <p>{t('adminRoles.review.none')}</p>}
      </section>
    </div>} />;
};
