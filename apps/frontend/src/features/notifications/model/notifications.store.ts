import { create } from 'zustand';

export type Notification = {
  id: number;
  content: string;
  read: boolean;
  createdAt: string;
};

type Store = {
  notifications: Notification[];
  setNotifications: (n: Notification[]) => void;
  addNotification: (n: Notification) => void;
  markAsRead: (id: number) => void;
};

export const useNotificationStore = create<Store>((set) => ({
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) =>
  set((state) => ({

    notifications: [notification, ...state.notifications],
  })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
}));