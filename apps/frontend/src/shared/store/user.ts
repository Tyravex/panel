import { create } from 'zustand';
import type { User } from '@/entities/User';
import { updatePreferences } from '@/features/user/api/updatePreferences';
import i18n from '@/shared/i18n';

interface UserState {
  user: User | null;
  language: string;
  avatar: string;

  setUser: (user: User | null) => void;
  setLanguage: (lang: string) => void;
  updateLanguage: (lang: string) => Promise<void>;
}

export const useUser = create<UserState>((set) => ({
  user: null,
  language: 'en',
  avatar: '',

  setUser: (user) => {
    if (user) {
      const language = user.language || 'en';

      i18n.changeLanguage(language);

      set({
        user,
        language,
        avatar: user.avatar ?? '',
      });

      return;
    }

    set({
      user: null,
      avatar: '',
    });
  },

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
      console.error('Failed to update language:', e);
    }
  },
}));