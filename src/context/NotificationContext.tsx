import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LibraryNotification } from '../types';
import { initialNotifications } from '../data/initialData';
import { useAuth } from './AuthContext';
import {
  CHAT_NOTIF_EVENT_NAME,
  CHAT_SYNC_CHANNEL_NAME,
  TAB_INSTANCE_ID,
  loadChatSettings,
  playChatNotificationTone,
  showBrowserPushNotification,
  triggerOpenChatConversation,
} from '../lib/chatService';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  conversationId?: string;
}

interface NotificationContextType {
  notifications: LibraryNotification[];
  allNotifications: LibraryNotification[];
  toasts: Toast[];
  showToast: (
    message: string,
    type?: 'success' | 'error' | 'info' | 'warning',
    title?: string,
    conversationId?: string
  ) => void;
  removeToast: (id: string) => void;
  addNotification: (notif: Omit<LibraryNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: number;
  pendingChatConversationId: string | null;
  setPendingChatConversationId: (id: string | null) => void;
}

const NOTIF_STORAGE_KEY = 'wathba_notifications_v1';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authMode, currentStudent, currentStaff } = useAuth();

  const [allNotifications, setAllNotifications] = useState<LibraryNotification[]>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialNotifications;
    } catch {
      return initialNotifications;
    }
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingChatConversationId, setPendingChatConversationId] = useState<string | null>(null);
  const allNotificationsRef = useRef<LibraryNotification[]>(allNotifications);
  allNotificationsRef.current = allNotifications;
  const skipNextNotifStorageWriteRef = useRef<boolean>(false);
  const seenDedupeKeysRef = useRef<Set<string>>(
    new Set(
      allNotifications
        .map((n) => n.dedupeKey)
        .filter((k): k is string => Boolean(k))
    )
  );

  useEffect(() => {
    if (skipNextNotifStorageWriteRef.current) {
      skipNextNotifStorageWriteRef.current = false;
      return;
    }
    try {
      const nextSerialized = JSON.stringify(allNotifications);
      const currentRaw = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (currentRaw !== nextSerialized) {
        localStorage.setItem(NOTIF_STORAGE_KEY, nextSerialized);
      }
    } catch (e) {
      console.warn('Failed saving notifications:', e);
    }
  }, [allNotifications]);

  const matchesCurrentSession = useCallback(
    (notif: Pick<LibraryNotification, 'recipientType' | 'recipientRole' | 'studentId' | 'staffId'>): boolean => {
      if (notif.recipientType === 'broadcast') return true;
      if (authMode === 'student' && currentStudent) {
        if (notif.recipientType !== 'student') return false;
        return !notif.studentId || notif.studentId === currentStudent.id;
      }
      if (authMode === 'admin' && currentStaff) {
        if (notif.recipientType !== 'staff') return false;
        if (notif.staffId) return notif.staffId === currentStaff.id;
        return !notif.recipientRole || notif.recipientRole === 'admin';
      }
      if (authMode === 'supervisor' && currentStaff) {
        if (notif.recipientType !== 'staff') return false;
        if (notif.staffId) return notif.staffId === currentStaff.id;
        return notif.recipientRole !== 'admin';
      }
      return false;
    },
    [authMode, currentStaff, currentStudent]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' | 'info' | 'warning' = 'info',
      title?: string,
      conversationId?: string
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: Toast = { id, message, type, title, conversationId };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const addNotification = useCallback(
    (notif: Omit<LibraryNotification, 'id' | 'createdAt' | 'isRead'>) => {
      const dedupeKey =
        notif.dedupeKey ||
        (notif.sourceMessageId
          ? `msg-${notif.sourceMessageId}-${notif.recipientType}-${notif.studentId || notif.staffId || notif.recipientRole || 'all'}`
          : undefined);

      if (dedupeKey && seenDedupeKeysRef.current.has(dedupeKey)) {
        return;
      }
      if (dedupeKey) {
        seenDedupeKeysRef.current.add(dedupeKey);
      }

      setAllNotifications((prev) => {
        if (dedupeKey && prev.some((existing) => existing.dedupeKey === dedupeKey)) {
          return prev;
        }
        const newNotif: LibraryNotification = {
          ...notif,
          dedupeKey,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        return [newNotif, ...prev].slice(0, 120);
      });

      if (matchesCurrentSession(notif)) {
        showToast(
          notif.message,
          notif.type === 'urgent' ? 'error' : notif.type || 'info',
          notif.title,
          notif.conversationId
        );
        if (notif.conversationId) {
          const chatSettings = loadChatSettings();
          if (chatSettings.enableSound) {
            playChatNotificationTone();
          }
          if (chatSettings.enableBrowserNotifications) {
            showBrowserPushNotification(notif.title, notif.message, notif.conversationId);
          }
        }
      }
    },
    [matchesCurrentSession, showToast]
  );

  // استقبال الإشعارات الفورية من نظام المحادثات وعبر التبويبات
  useEffect(() => {
    const handleCustomNotif = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<LibraryNotification, 'id' | 'createdAt' | 'isRead'>>;
      if (customEvent?.detail) {
        addNotification(customEvent.detail);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === NOTIF_STORAGE_KEY && e.newValue) {
        try {
          if (e.newValue === JSON.stringify(allNotificationsRef.current)) {
            return;
          }
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            parsed.forEach((n: LibraryNotification) => {
              if (n.dedupeKey) seenDedupeKeysRef.current.add(n.dedupeKey);
            });
            skipNextNotifStorageWriteRef.current = true;
            setAllNotifications(parsed);
          }
        } catch {
          // ignore
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(CHAT_SYNC_CHANNEL_NAME);
        channel.onmessage = (event) => {
          const data = event.data;
          if (!data || data.sourceTabId === TAB_INSTANCE_ID) return;
          if (data.type === 'NOTIFICATION_EMIT' && data.notification) {
            addNotification(data.notification);
          }
        };
      }
    } catch {
      // ignore
    }

    window.addEventListener(CHAT_NOTIF_EVENT_NAME, handleCustomNotif);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(CHAT_NOTIF_EVENT_NAME, handleCustomNotif);
      window.removeEventListener('storage', handleStorage);
      if (channel) {
        try {
          channel.close();
        } catch {
          // ignore
        }
      }
    };
  }, [addNotification]);

  const notifications = useMemo(
    () => allNotifications.filter((n) => matchesCurrentSession(n)),
    [allNotifications, matchesCurrentSession]
  );

  const markAsRead = useCallback((id: string) => {
    setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setAllNotifications((prev) =>
      prev.map((n) => (matchesCurrentSession(n) ? { ...n, isRead: true } : n))
    );
  }, [matchesCurrentSession]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        allNotifications,
        toasts,
        showToast,
        removeToast,
        addNotification,
        markAsRead,
        markAllAsRead,
        unreadCount,
        pendingChatConversationId,
        setPendingChatConversationId,
      }}
    >
      {children}
      {/* Toast Render View */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => {
              if (toast.conversationId) {
                setPendingChatConversationId(toast.conversationId);
                triggerOpenChatConversation(
                  toast.conversationId,
                  authMode === 'student' ? 'student' : authMode === 'admin' ? 'admin' : 'supervisor'
                );
                removeToast(toast.id);
              }
            }}
            className={`pointer-events-auto p-4 rounded-xl shadow-card border backdrop-blur-md flex items-start justify-between gap-3 transform transition-all duration-300 animate-slide-up ${
              toast.conversationId ? 'cursor-pointer hover:scale-[1.01]' : ''
            } ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 text-white border-emerald-500'
                : toast.type === 'error'
                ? 'bg-rose-900/90 text-white border-rose-500'
                : toast.type === 'warning'
                ? 'bg-amber-900/90 text-white border-amber-500'
                : 'bg-slate-900/90 text-white border-slate-700'
            }`}
          >
            <div>
              {toast.title && <div className="font-bold text-sm mb-0.5">{toast.title}</div>}
              <div className="text-xs leading-relaxed opacity-95">{toast.message}</div>
              {toast.conversationId && (
                <div className="text-[10px] font-bold text-emerald-300 mt-1">
                  اضغط لفتح المحادثة مباشرة ←
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="text-white/60 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};
