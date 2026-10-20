import { useTranslation } from 'react-i18next';
import { ProfileForm } from '@/features/profile/components/ProfileForm';

export const ProfilePage = () => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          {t('profile.title')}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {t('profile.description')}
        </p>
      </div>

      <ProfileForm />
    </div>
  );
};