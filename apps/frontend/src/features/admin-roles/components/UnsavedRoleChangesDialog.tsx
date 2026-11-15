import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

export const UnsavedRoleChangesDialog = ({ open, onDiscard, onStay }: {
  open: boolean; onDiscard: () => void; onStay: () => void;
}) => {
  const { t } = useTranslation();
  return <ConfirmDialog open={open} destructive title={t('adminRoles.unsaved.title')}
    description={t('adminRoles.unsaved.description')} confirmLabel={t('adminRoles.unsaved.discard')}
    onConfirm={onDiscard} onCancel={onStay} />;
};
