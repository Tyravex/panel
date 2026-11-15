import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EggTagManager } from '@/features/eggs/components/EggTagManager';
import { PersonalEggTags } from '@/features/eggs/components/PersonalEggTags';
export const EggTagsPage = () => {
  const { t } = useTranslation();
  return <div className="space-y-6"><Link to="/settings">{t('common.back')}</Link><h1 className="text-3xl font-bold">{t('eggs.tags')}</h1><EggTagManager /><PersonalEggTags /></div>;
};
