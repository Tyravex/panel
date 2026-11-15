import { useTranslation } from 'react-i18next';
import { EggsNavigation } from '@/features/eggs/components/EggsNavigation';
import { EggTagManager } from '@/features/eggs/components/EggTagManager';
export const AdminEggTagsPage = () => {
  const { t } = useTranslation();
  return <div className="space-y-6"><h1 className="text-3xl font-bold">{t('eggs.tags')}</h1><EggsNavigation /><EggTagManager /></div>;
};
