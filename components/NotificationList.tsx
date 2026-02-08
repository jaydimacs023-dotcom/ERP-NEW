import React from 'react';
import { useNotifications } from './NotificationContext';

const typeColors: Record<string, string> = {
  info: 'bg-teal-500',
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
};

export const NotificationList: React.FC = () => {
  const { notifications, markRead, clearAll } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase">Notifications</span>
        <button onClick={clearAll} className="text-xs text-slate-400 hover:text-red-400">Clear All</button>
      </div>
      <ul className="space-y-2">
        {notifications.map(n => (
          <li key={n.id} className={`flex items-start gap-3 p-4 rounded-xl shadow-lg text-white ${typeColors[n.type] || 'bg-slate-700'} ${n.read ? 'opacity-60' : ''}`}>
            <div className="flex-1">
              <div className="text-sm font-bold">{n.message}</div>
              <div className="text-xs text-slate-200/70 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            {!n.read && (
              <button onClick={() => markRead(n.id)} className="ml-2 text-xs underline">Mark Read</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
