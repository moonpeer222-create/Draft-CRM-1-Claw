import { create } from 'zustand';

export type Notification = {
  id: string;
  type: "case" | "payment" | "alert" | "document" | "system" | "status" | "flag" | "report" | "deadline" | "agent" | "customer" | "attendance";
  priority?: "high" | "medium" | "low" | "critical";
  title?: string;
  titleUrdu?: string;
  message: string;
  messageUr?: string;
  messageUrdu?: string;
  timestamp: string;
  time?: string;
  read: boolean;
  actionable?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  targetRole?: string;
  targetUserId?: string;
  metadata?: Record<string, any>;
}

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