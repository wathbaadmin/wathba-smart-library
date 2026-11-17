import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Clock, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { formatArabicDateTime } from '../../lib/dateUtils';
import {
  requestBrowserNotificationPermission,
  triggerOpenChatConversation,
} from '../../lib/chatService';

interface NotificationBellProps {
  onOpenConversation?: (conversationId: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenConversation }) => {
  const { authMode } = useAuth();
  const { chatSettings, updateChatSettings } = useLibrary();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    setPendingChatConversationId,
    showToast,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleBrowserNotif = async () => {
    if (!chatSettings.enableBrowserNotifications) {
      const perm = await requestBrowserNotificationPermission();
      if (perm === 'granted') {
        updateChatSettings({ enableBrowserNotifications: true });
        showToast('تم تفعيل إشعارات المتصفح بنجاح.', 'success');
      } else if (perm === 'denied') {
        showToast('تم رفض إذن الإشعارات من إعدادات المتصفح.', 'warning');
      } else {
        showToast('المتصفح الحالي لا يدعم إشعارات سطح المكتب.', 'info');
      }
    } else {
      updateChatSettings({ enableBrowserNotifications: false });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:text-[#3b707d] hover:bg-[#e3ecf3]/70 transition-colors"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 left-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute left-3 right-3 sm:right-auto sm:left-0 top-18 sm:top-auto sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-premium border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-800">التنبيهات والإشعارات</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-wathba-100 text-wathba-800 font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateChatSettings({ enableSound: !chatSettings.enableSound })}
                title={chatSettings.enableSound ? 'كتم صوت الرسائل' : 'تفعيل صوت الرسائل'}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 transition-colors"
              >
                {chatSettings.enableSound ? (
                  <Volume2 className="w-3.5 h-3.5 text-wathba-700" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-wathba-600 hover:text-wathba-800 flex items-center gap-1 font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  تحديد الكل كمقروء
                </button>
              )}
            </div>
          </div>

          <div className="px-4 py-2 bg-wathba-50/50 border-b border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium">إشعارات المتصفح للرسائل الجديدة</span>
            <button
              type="button"
              onClick={handleToggleBrowserNotif}
              className={`px-2 py-0.5 rounded-full font-bold transition-colors ${
                chatSettings.enableBrowserNotifications
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              {chatSettings.enableBrowserNotifications ? 'مفعّلة' : 'تفعيل'}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">لا توجد تنبيهات حالياً</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => {
                    markAsRead(notif.id);
                    if (notif.conversationId) {
                      setPendingChatConversationId(notif.conversationId);
                      triggerOpenChatConversation(
                        notif.conversationId,
                        authMode === 'student'
                          ? 'student'
                          : authMode === 'admin'
                          ? 'admin'
                          : 'supervisor'
                      );
                      onOpenConversation?.(notif.conversationId);
                      setIsOpen(false);
                    }
                  }}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${
                    !notif.isRead ? 'bg-wathba-50/40 font-medium' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      {notif.conversationId && (
                        <MessageSquare className="w-3.5 h-3.5 text-wathba-600 shrink-0" />
                      )}
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatArabicDateTime(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                  {notif.conversationId && (
                    <span className="inline-block text-[10px] font-bold text-wathba-700 mt-1.5">
                      عرض المحادثة ←
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
