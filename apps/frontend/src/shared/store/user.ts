import { create } from "zustand";
import { updatePreferences } from "@/features/user/api/updatePreferences";
import i18n from "@/shared/i18n"

interface User {
  id: number;
  email: string;
  username: string;
  language: string;
  avatar: String;
}

interface UserState {
  user: User | null;
  language: string;
  avatar: string;

  setUser: (user: User) => void;
  setLanguage: (lang: string) => void;
  updateLanguage: (lang: string) => Promise<void>;
}

export const useUser = create<UserState>((set) => ({
  user: null,
  language: "en",
  avatar: "",

  setUser: (user) => set({ user }),
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
  },

  updateLanguage: async (language) => {
    i18n.changeLanguage(language);
    set({ language });
    try {
      await updatePreferences({ language });
    } catch (e) {
      console.error("Failed to update language:", e);
    };
  },
}));