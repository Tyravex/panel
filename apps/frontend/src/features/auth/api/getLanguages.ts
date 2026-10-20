import { api } from '@/shared/api/client';

export type Language = {
    code: string;
    name: string;
};

export const getLanguages = async (): Promise<Language[]> => {
    const response = await api.get<Language[]>('/languages');

    return response.data;
};