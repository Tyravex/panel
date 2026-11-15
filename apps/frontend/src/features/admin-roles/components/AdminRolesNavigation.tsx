import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Columns2, Shield } from 'lucide-react';

export const AdminRolesNavigation = () => {
  const { t } = useTranslation();
  return <nav aria-label={t('adminRoles.navigation')} className="flex flex-wrap gap-2 border-b border-border-subtle pb-3">
    {[
      { to: '/admin/roles', label: 'adminRoles.rolesTab', icon: Shield },
      { to: '/admin/roles/compare', label: 'adminRoles.compare.title', icon: Columns2 },
    ].map(({ to, label, icon: Icon }) => (
      <NavLink key={to} to={to} end className={({ isActive }) =>
        `inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${isActive
          ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}>
        <Icon size={17} aria-hidden="true" />{t(label)}
      </NavLink>
    ))}
  </nav>;
};
