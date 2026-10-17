import { api } from "@/shared/api/client";

export interface UserPreferencesUpdate {
  language: string;
}

export const updatePreferences = async (
  data: UserPreferencesUpdate,
): Promise<void> => {
  await api.patch("/user/preferences", data, {
    withCredentials: true,
  });
};
