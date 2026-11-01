import { api } from '@/shared/api/client';

export type LanguageOption = {
    code: string;
    name: string;
    enabled: boolean;
};

export const getLanguageOptions = async (): Promise<LanguageOption[]> => {
    const response = await api.get<LanguageOption[]>(
        '/languages/available-options',
    );

    return response.data;
};