import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
export const SettingsPage = () => {
  const { t } = useTranslation();
  return <div className="space-y-6 p-6"><h1 className="text-3xl font-bold">{t('navigation.settings')}</h1>
    <Link className="inline-flex rounded-xl border border-border-subtle bg-surface px-5 py-3 text-primary" to="/settings/egg-tags">{t('eggs.myEggTags')}</Link>
  </div>;
};
