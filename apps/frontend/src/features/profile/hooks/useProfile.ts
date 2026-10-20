import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/app/store/auth.store';
import { useUser } from '@/shared/store/user';
import { updateProfileApi } from '../api/profile.api';

export const useProfile = () => {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);

    const [firstName, setFirstName] = useState(user?.firstName ?? '');
    const [lastName, setLastName] = useState(user?.lastName ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const [errorKey, setErrorKey] = useState<string | null>(null);
    const [successKey, setSuccessKey] = useState<string | null>(null);

    useEffect(() => {
        setFirstName(user?.firstName ?? '');
        setLastName(user?.lastName ?? '');
    }, [user?.id, user?.firstName, user?.lastName]);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (isSaving || !user) return;

        setErrorKey(null);
        setSuccessKey(null);
        setIsSaving(true);

        const sessionVersion = useAuthStore.getState().sessionVersion;
        const userId = user.id;

        try {
            const response = await updateProfileApi({
                firstName: firstName.trim() || null,
                lastName: lastName.trim() || null,
            });

            const authState = useAuthStore.getState();

            if (
                authState.sessionVersion !== sessionVersion ||
                authState.user?.id !== userId ||
                response.id !== userId
            ) {
                return;
            }

            const updatedUser = {
                ...authState.user,
                firstName: response.firstName,
                lastName: response.lastName,
            };

            authState.setUser(updatedUser);
            useUser.getState().setUser(updatedUser);

            setSuccessKey('profile.saved');
        } catch (err) {
            if (
                useAuthStore.getState().sessionVersion !== sessionVersion ||
                useAuthStore.getState().user?.id !== userId
            ) {
                return;
            }

            if (axios.isAxiosError(err) && err.response?.status === 400) {
                setErrorKey('profile.invalidName');
            } else {
                setErrorKey('profile.saveError');
            }
        } finally {
            setIsSaving(false);
        }
    };

    return {
        user,
        firstName,
        lastName,
        setFirstName,
        setLastName,
        isSaving,
        error: errorKey ? t(errorKey) : null,
        success: successKey ? t(successKey) : null,
        submit,
    };
};