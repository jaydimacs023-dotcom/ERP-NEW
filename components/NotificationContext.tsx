import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { notificationService, Notification, NotificationType } from '../services/NotificationService';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(notificationService.getAll());

  useEffect(() => {
    const sync = () => setNotifications(notificationService.getAll());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const addNotification = (type: NotificationType, message: string) => {
    notificationService.add(type, message);
    setNotifications(notificationService.getAll());
  };

  const markRead = (id: string) => {
    notificationService.markRead(id);
    setNotifications(notificationService.getAll());
  };

  const clearAll = () => {
    notificationService.clearAll();
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
