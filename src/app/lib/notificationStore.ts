import { create } from 'zustand';
import type { Notification } from '../lib/notifications';

interface NotificationState {
  notifications: Notification[];
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  
  setNotifications: (notifications) => set({ notifications }),
  
  addNotification: (notification) =>
    set((state) => ({ notifications: [notification, ...state.notifications] })),
    
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
}));