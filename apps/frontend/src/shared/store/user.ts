import { create } from "zustand";
import type { User } from "@/entities/User";
import { updatePreferences } from "@/features/user/api/updatePreferences";
import i18n from "@/shared/i18n";

interface UserState {
  user: User | null;
  language: string;
  avatar: string;

  setUser: (user: User | null) => void;
  setLanguage: (lang: string) => void;
  updateLanguage: (lang: string) => Promise<void>;
}

export const useUser = create<UserState>((set, get) => ({
  user: null,
  language: "en",
  avatar: "",

  setUser: (user) => {
    if (user) {
      const language = user.language || "en";

      void i18n.changeLanguage(language);

      set({
        user,
        language,
        avatar: user.avatar ?? "",
      });

      return;
    }

    set({
      user: null,
      avatar: "",
    });
  },

  setLanguage: (language) => {
    void i18n.changeLanguage(language);
    set({ language });
  },

  updateLanguage: async (language) => {
    const previousLanguage = get().language;

    if (language === previousLanguage) {
      return;
    }

    // Update the interface immediately.
    set({ language });
    void i18n.changeLanguage(language);

    try {
      await updatePreferences({ language });

      // Keep the user object consistent with the saved preference.
      set((state) => ({
        user: state.user
          ? { ...state.user, language }
          : null,
      }));
    } catch (error) {
      // Restore the previous language if the API request fails.
      set({ language: previousLanguage });
      void i18n.changeLanguage(previousLanguage);

      console.error("Failed to update language:", error);

      // Allow the UI to display an error message.
      throw error;
    }
  },
}));
