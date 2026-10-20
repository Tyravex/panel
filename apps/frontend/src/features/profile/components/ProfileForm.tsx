import { useTranslation } from 'react-i18next';
import { useProfile } from '../hooks/useProfile';

export const ProfileForm = () => {
    const { t } = useTranslation();

    const {
        user,
        firstName,
        lastName,
        setFirstName,
        setLastName,
        isSaving,
        error,
        success,
        submit,
    } = useProfile();

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="mb-6">
                <h2 className="text-xl font-semibold">
                    {t('profile.accountDetails')}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                    {t('profile.readOnlyHint')}
                </p>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <div>
                    <label
                        htmlFor="profile-username"
                        className="mb-2 block text-sm font-medium"
                    >
                        {t('profile.username')}
                    </label>
                    <input
                        id="profile-username"
                        value={user?.username ?? ''}
                        readOnly
                        className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-gray-400 outline-none"
                    />
                </div>

                <div>
                    <label
                        htmlFor="profile-email"
                        className="mb-2 block text-sm font-medium"
                    >
                        {t('profile.email')}
                    </label>
                    <input
                        id="profile-email"
                        value={user?.email ?? ''}
                        readOnly
                        className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-gray-400 outline-none"
                    />
                </div>
            </div>

            <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label
                            htmlFor="profile-first-name"
                            className="mb-2 block text-sm font-medium"
                        >
                            {t('profile.firstName')}
                        </label>
                        <input
                            id="profile-first-name"
                            type="text"
                            autoComplete="given-name"
                            maxLength={80}
                            value={firstName}
                            onChange={(event) => setFirstName(event.target.value)}
                            placeholder={t('profile.firstNamePlaceholder')}
                            className="w-full rounded-lg border border-white/10 bg-white/10 p-3 outline-none focus:border-cyan-400"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="profile-last-name"
                            className="mb-2 block text-sm font-medium"
                        >
                            {t('profile.lastName')}
                        </label>
                        <input
                            id="profile-last-name"
                            type="text"
                            autoComplete="family-name"
                            maxLength={80}
                            value={lastName}
                            onChange={(event) => setLastName(event.target.value)}
                            placeholder={t('profile.lastNamePlaceholder')}
                            className="w-full rounded-lg border border-white/10 bg-white/10 p-3 outline-none focus:border-cyan-400"
                        />
                    </div>
                </div>

                <p className="text-sm text-gray-400">
                    {t('profile.optionalNamesHint')}
                </p>

                {error && (
                    <p role="alert" className="text-sm text-red-400">
                        {error}
                    </p>
                )}

                {success && (
                    <p role="status" className="text-sm text-green-400">
                        {success}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isSaving || !user}
                    className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isSaving ? t('profile.saving') : t('profile.save')}
                </button>
            </form>
        </div>
    );
};