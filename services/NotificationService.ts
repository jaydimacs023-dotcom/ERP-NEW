// NotificationService.ts
// Persistent notification storage using localStorage

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  createdAt: number;
  read: boolean;
}

const STORAGE_KEY = 'AT_ERP_NOTIFICATIONS';

export class NotificationService {
  private notifications: Notification[] = [];

  constructor() {
    this.load();
  }

  private load() {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this.notifications = JSON.parse(raw);
        } catch {}
      }
    }
  }

  private save() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
    }
  }

  getAll(): Notification[] {
    return [...this.notifications].sort((a, b) => b.createdAt - a.createdAt);
  }

  add(type: NotificationType, message: string): Notification {
    const notification: Notification = {
      id: Math.random().toString(36).slice(2) + Date.now(),
      type,
      message,
      createdAt: Date.now(),
      read: false,
    };
    this.notifications.push(notification);
    this.save();
    return notification;
  }

  markRead(id: string) {
    const n = this.notifications.find(n => n.id === id);
    if (n) {
      n.read = true;
      this.save();
    }
  }

  clearAll() {
    this.notifications = [];
    this.save();
  }
}

export const notificationService = new NotificationService();
