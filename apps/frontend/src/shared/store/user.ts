import { create } from 'zustand';

import type { User } from '@/entities/User';
import { updatePreferences } from '@/features/user/api/updatePreferences';

import i18n, {
  getSavedLanguage,
  LANGUAGE_STORAGE_KEY,
} from '@/shared/i18n';

import {
  getAvailableLanguages,
  resolveActiveLanguage,
} from '@/shared/i18n/availableLanguages';

const saveLanguage = (language: string): void => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Language still works for the current session.
  }
};

let languageSyncVersion = 0;
let languageUpdateVersion = 0;

let languageChangeQueue: Promise<void> = Promise.resolve();
let languageSaveQueue: Promise<void> = Promise.resolve();

const initialLanguage = getSavedLanguage();

interface UserState {
  user: User | null;
  language: string;
  activeLanguage: string;
  avatar: string;

  setUser: (user: User | null) => void;
  setLanguage: (language: string) => void;
  updateLanguage: (language: string) => Promise<void>;
  syncActiveLanguage: () => Promise<void>;
}

const logLanguageSyncError = (error: unknown): void => {
  console.error('Failed to synchronize active language:', error);
};

export const useUser = create<UserState>((set, get) => ({
  user: null,
  language: initialLanguage,
  activeLanguage: i18n.resolvedLanguage ?? 'en',
  avatar: '',

  setUser: (user) => {
    languageUpdateVersion++;
    languageSyncVersion++;

    if (user) {
      const language = user.language || 'en';

      saveLanguage(language);

      set({
        user,
        language,
        avatar: user.avatar ?? '',
      });

      void get().syncActiveLanguage().catch(logLanguageSyncError);
      return;
    }

    set({
      user: null,
      avatar: '',
    });
  },

  setLanguage: (language) => {
    languageUpdateVersion++;

    saveLanguage(language);
    set({ language });

    void get().syncActiveLanguage().catch(logLanguageSyncError);
  },

  updateLanguage: async (language) => {
    const previousLanguage = get().language;

    if (language === previousLanguage) {
      return;
    }

    const updateVersion = ++languageUpdateVersion;

    set({ language });

    const syncPromise = get().syncActiveLanguage();

    const savePreference = async (): Promise<void> => {
      if (updateVersion !== languageUpdateVersion) {
        return;
      }

      await updatePreferences({ language });
    };

    const savePromise = languageSaveQueue.then(savePreference);

    languageSaveQueue = savePromise.then(
      () => undefined,
      () => undefined,
    );

    try {
      await savePromise;
    } catch (error) {
      if (updateVersion !== languageUpdateVersion) {
        void syncPromise.catch(logLanguageSyncError);
        return;
      }

      set({ language: previousLanguage });

      void syncPromise.catch(logLanguageSyncError);

      try {
        await get().syncActiveLanguage();
      } catch (syncError) {
        logLanguageSyncError(syncError);
      }

      console.error('Failed to update language:', error);
      throw error;
    }

    if (updateVersion !== languageUpdateVersion) {
      void syncPromise.catch(logLanguageSyncError);
      return;
    }

    saveLanguage(language);

    set((state) => ({
      user: state.user
        ? { ...state.user, language }
        : null,
    }));

    try {
      await syncPromise;
    } catch (error) {
      logLanguageSyncError(error);
    }
  },

  syncActiveLanguage: async () => {
    const syncVersion = ++languageSyncVersion;
    const preferredLanguage = get().language;

    const availableLanguages = await getAvailableLanguages();

    if (
      syncVersion !== languageSyncVersion ||
      get().language !== preferredLanguage
    ) {
      return;
    }

    const activeLanguage = resolveActiveLanguage(
      preferredLanguage,
      availableLanguages,
    );

    const changeLanguage = async (): Promise<void> => {
      if (
        syncVersion !== languageSyncVersion ||
        get().language !== preferredLanguage
      ) {
        return;
      }

      await i18n.changeLanguage(activeLanguage);

      if (
        syncVersion !== languageSyncVersion ||
        get().language !== preferredLanguage
      ) {
        return;
      }

      set({ activeLanguage });
    };

    languageChangeQueue = languageChangeQueue
      .catch(() => {
        // Keep the queue usable after a previous failure.
      })
      .then(changeLanguage);

    await languageChangeQueue;
  },
}));
