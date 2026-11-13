import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const AdminUsersBackLink = () => {
  const { t } = useTranslation();

  return (
    <Link
      to="/admin/users"
      className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-primary"
    >
      <span aria-hidden="true">←</span>
      {t('adminUsers.backToUsers')}
    </Link>
  );
};
