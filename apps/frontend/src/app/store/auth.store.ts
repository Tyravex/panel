import { create } from 'zustand';
import type { User } from '@/entities/User';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  sessionVersion: number;

  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  sessionVersion: 0,

  setUser: (user) =>
    set({
      user,
      isLoading: false,
    }),

  logout: () =>
    set((state) => ({
      user: null,
      isLoading: false,
      sessionVersion: state.sessionVersion + 1,
    })),
}));