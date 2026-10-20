import { api } from '@/shared/api/client';

export type RegistrationSettings = {
    registrationEnabled: boolean;
};

export const getRegistrationSettingsApi = () =>
    api.get<RegistrationSettings>('/admin/registration-settings');

export const updateRegistrationSettingsApi = (
    registrationEnabled: boolean,
) =>
    api.patch<RegistrationSettings>('/admin/registration-settings', {
        registrationEnabled,
    });