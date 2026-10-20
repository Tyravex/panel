import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SurfaceCard } from '@/shared/ui/SurfaceCard';
import type { AdminUserFormValues } from '../api/admin-users.api';

type Props = {
    creating: boolean;
    form: AdminUserFormValues;
    setForm: (value: AdminUserFormValues) => void;
    busy: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onCancel: () => void;
};

export const AdminUserForm = ({
    creating,
    form,
    setForm,
    busy,
    onSubmit,
    onCancel,
}: Props) => {
    const { t } = useTranslation();

    const update = (field: keyof AdminUserFormValues, value: string) => {
        setForm({ ...form, [field]: value });
    };

    const inputClass =
        'mt-1 w-full rounded-lg border border-border-subtle bg-transparent p-2';

    return (
        <SurfaceCard>
            <form onSubmit={onSubmit} className="space-y-3">
                <h2 className="text-lg font-semibold">
                    {t(creating ? 'adminUsers.createUser' : 'adminUsers.editUser')}
                </h2>

                <label className="block text-sm">
                    {t('adminUsers.username')}
                    <input
                        required
                        minLength={3}
                        maxLength={32}
                        pattern="[A-Za-z0-9_-]+"
                        value={form.username}
                        onChange={(event) => update('username', event.target.value)}
                        className={inputClass}
                    />
                </label>

                <label className="block text-sm">
                    {t('adminUsers.email')}
                    <input
                        required
                        type="email"
                        maxLength={254}
                        value={form.email}
                        onChange={(event) => update('email', event.target.value)}
                        className={inputClass}
                    />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                        {t('adminUsers.firstName')} ({t('common.optional')})
                        <input
                            type="text"
                            autoComplete="given-name"
                            maxLength={80}
                            value={form.firstName}
                            onChange={(event) =>
                                update('firstName', event.target.value)
                            }
                            className={inputClass}
                        />
                    </label>

                    <label className="block text-sm">
                        {t('adminUsers.lastName')} ({t('common.optional')})
                        <input
                            type="text"
                            autoComplete="family-name"
                            maxLength={80}
                            value={form.lastName}
                            onChange={(event) =>
                                update('lastName', event.target.value)
                            }
                            className={inputClass}
                        />
                    </label>
                </div>

                {creating && (
                    <label className="block text-sm">
                        {t('adminUsers.initialPassword')}
                        <input
                            required
                            type="password"
                            autoComplete="new-password"
                            minLength={12}
                            maxLength={128}
                            value={form.password}
                            onChange={(event) =>
                                update('password', event.target.value)
                            }
                            className={inputClass}
                        />
                    </label>
                )}

                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
                    >
                        {t(busy ? 'adminUsers.saving' : 'adminUsers.save')}
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={onCancel}
                        className="rounded-lg border border-border-subtle px-4 py-2 disabled:opacity-50"
                    >
                        {t('adminUsers.cancel')}
                    </button>
                </div>
            </form>
        </SurfaceCard>
    );
};