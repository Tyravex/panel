import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EggRepositoryForm } from '@/features/eggs/components/EggRepositoryForm';
export const AdminEggRepositoryCreatePage = () => { const { t } = useTranslation(); return <div className="space-y-6"><Link to="/admin/eggs/repositories">← {t('eggs.repositories')}</Link><h1 className="text-3xl font-bold">{t('eggs.addRepository')}</h1><EggRepositoryForm /></div>; };
