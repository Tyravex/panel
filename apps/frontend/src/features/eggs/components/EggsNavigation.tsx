import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const EggsNavigation = () => {
  const { t } = useTranslation();
  return <nav aria-label={t('eggs.navigation')} className="flex gap-3 border-b border-border-subtle pb-3">
    {[['/admin/eggs', 'eggs.library'], ['/admin/eggs/repositories', 'eggs.repositories'], ['/admin/eggs/tags', 'eggs.tags']].map(([to, label]) =>
      <NavLink key={to} to={to} end className={({ isActive }) => `rounded-xl px-4 py-2 text-sm ${isActive ? 'bg-primary/15 text-primary' : 'text-text-secondary'}`}>{t(label)}</NavLink>)}
  </nav>;
};
