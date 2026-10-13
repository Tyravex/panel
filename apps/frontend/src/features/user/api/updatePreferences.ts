import { api } from '@/app/api/axios';

export const updatePreferences = async (data: any) => {
  // console.log("Sending language update:", data);
  try {
    const response = await api.patch("/user/preferences", data, {
      withCredentials: true,
    });
    return response.data;
  } catch (err) {
    console.error("Failed to update language:", err);
    throw err;
  }
};