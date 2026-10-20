import { api } from '@/shared/api/client';

export type ProfileResponse = {
    id: number;
    username: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
};

export type UpdateProfileInput = {
    firstName: string | null;
    lastName: string | null;
};

export const updateProfileApi = async (
    input: UpdateProfileInput,
): Promise<ProfileResponse> => {
    const { data } = await api.patch<ProfileResponse>(
        '/user/profile',
        input,
    );

    return data;
};