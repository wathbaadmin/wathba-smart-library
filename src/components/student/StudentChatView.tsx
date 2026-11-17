import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  Send,
  Paperclip,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  Search,
  Plus,
  Pin,
  WifiOff,
  ChevronRight,
  ChevronUp,
  X,
  Building2,
  Reply,
  SlidersHorizontal,
  RefreshCw,
  Bell,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ChatMessage, Conversation } from '../../types';
import {
  CONVERSATION_STATUS_META,
  ChatMessageBubble,
  ImageLightboxModal,
  ChatDateSeparator,
  formatMessageDateDivider,
  formatLastSeenLabel,
  formatShortMessageTime,
} from '../common/ChatSharedComponents';
import { readAndValidateAttachment, requestBrowserNotificationPermission } from '../../lib/chatService';

interface StudentChatViewProps {
  initialConversationId?: string;
  onConversationOpened?: () => void;
}

const MESSAGES_PAGE_SIZE = 30;

export const StudentChatView: React.FC<StudentChatViewProps> = ({
  initialConversationId,
  onConversationOpened,
}) => {
  const { currentStudent } = useAuth();
  const {
    conversations,
    messages,
    staff,
    chatSettings,
    chatOutbox,
    isChatOnline,
    updateChatSettings,
    getActiveChatSupervisors,
    createOrGetConversation,
    sendChatMessage,
    retryChatMessage,
    flushChatOutbox,
    markConversationAsRead,
    updateConversationPresence,
    softDeleteChatMessage,
    toggleMessageReaction,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId || null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<'active' | 'unread' | 'archived'>('active');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showMobileThread, setShowMobileThread] = useState(Boolean(initialConversationId));

  // Thread controls
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    type: 'image' | 'file';
  } | null>(null);
  const [replyToMsg, setReplyToMsg] = useState<ChatMessage | null>(null);
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [showChatPrefs, setShowChatPrefs] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MESSAGES_PAGE_SIZE);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pendingSendLockRef = useRef<boolean>(false);

  const activeSupervisors = useMemo(() => getActiveChatSupervisors(), [getActiveChatSupervisors]);

  // المحادثات الخاصة بالطالب الحالي فقط (عزل تام)
  const myConversations = useMemo(() => {
    if (!currentStudent) return [];
    return (conversations || [])
      .filter((c) => c.studentId === currentStudent.id)
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
  }, [conversations, currentStudent]);

  const getConversationEntityInfo = (conv: Conversation) => {
    if (conv.recipientType === 'admin') {
      return {
        title: 'إدارة المكتبة',
        subtitle: 'صندوق وارد الإدارة الرسمي',
        isAdmin: true,
        isSupervisorActive: true,
      };
    }
    const sup = staff.find((s) => s.id === conv.supervisorId);
    return {
      title: sup?.fullName || 'مشرف المكتبة',
      subtitle:
        sup?.assignedGroups && sup.assignedGroups.length > 0
          ? `مشرف (${sup.assignedGroups.join('، ')})`
          : 'مشرف المكتبة',
      isAdmin: false,
      isSupervisorActive: sup ? sup.status === 'active' : false,
    };
  };

  const filteredConversations = useMemo(() => {
    return myConversations.filter((c) => {
      const archived = Boolean(c.isArchived || c.status === 'archived');
      if (sidebarFilter === 'archived' && !archived) return false;
      if (sidebarFilter !== 'archived' && archived) return false;
      if (sidebarFilter === 'unread' && (c.unreadCountStudent || 0) === 0) return false;

      if (sidebarSearch.trim()) {
        const q = sidebarSearch.trim().toLowerCase();
        const info = getConversationEntityInfo(c);
        const matchesName = info.title.toLowerCase().includes(q) || info.subtitle.toLowerCase().includes(q);
        const matchesPreview = (c.lastMessageContent || '').toLowerCase().includes(q);
        return matchesName || matchesPreview;
      }
      return true;
    });
  }, [myConversations, sidebarFilter, sidebarSearch, staff]);

  // فتح المحادثة القادمة من إشعار أو اختيار أول محادثة متاحة تلقائياً
  useEffect(() => {
    if (initialConversationId) {
      const exists = myConversations.find((c) => c.id === initialConversationId);
      if (exists) {
        setSelectedConvId(exists.id);
        setShowMobileThread(true);
        onConversationOpened?.();
      }
    } else if (!selectedConvId && myConversations.length > 0) {
      const firstActive =
        myConversations.find((c) => !c.isArchived && c.status !== 'archived') || myConversations[0];
      setSelectedConvId(firstActive.id);
    }
  }, [initialConversationId, myConversations, onConversationOpened, selectedConvId]);

  const activeConversation = useMemo(
    () => myConversations.find((c) => c.id === selectedConvId) || null,
    [myConversations, selectedConvId]
  );

  const allConversationMessages = useMemo(() => {
    if (!activeConversation) return [];
    return (messages || [])
      .filter((m) => m.conversationId === activeConversation.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeConversation, messages]);

  const displayedMessages = useMemo(() => {
    if (inChatSearchQuery.trim()) {
      const q = inChatSearchQuery.trim().toLowerCase();
      return allConversationMessages.filter(
        (m) => !m.isDeleted && (m.content.toLowerCase().includes(q) || (m.attachmentName || '').toLowerCase().includes(q))
      );
    }
    const startIdx = Math.max(0, allConversationMessages.length - visibleCount);
    return allConversationMessages.slice(startIdx);
  }, [allConversationMessages, inChatSearchQuery, visibleCount]);

  const hasOlderMessages =
    !inChatSearchQuery.trim() && allConversationMessages.length > visibleCount;

  // تحديد المحادثة كمقروءة وتحديث آخر ظهور عند فتحها
  useEffect(() => {
    if (!activeConversation || !currentStudent) return;
    setVisibleCount(MESSAGES_PAGE_SIZE);
    markConversationAsRead(activeConversation.id, 'student');
    updateConversationPresence(activeConversation.id, 'student');
  }, [activeConversation?.id, currentStudent?.id]);

  // عند وصول رسائل جديدة في المحادثة المفتوحة حالياً، اعتبرها مقروءة للطالب
  useEffect(() => {
    if (!activeConversation) return;
    if ((activeConversation.unreadCountStudent || 0) > 0) {
      markConversationAsRead(activeConversation.id, 'student');
    }
  }, [activeConversation?.id, activeConversation?.unreadCountStudent, allConversationMessages.length]);

  useEffect(() => {
    if (!inChatSearchQuery.trim()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allConversationMessages.length, activeConversation?.id]);

  if (!currentStudent) return null;

  const studentQueuedCount = chatOutbox.filter((q) => q.studentId === currentStudent.id).length;

  const handleSelectRecipient = (recipientType: 'admin' | 'supervisor', supervisorId?: string) => {
    const res = createOrGetConversation({
      studentId: currentStudent.id,
      recipientType,
      supervisorId,
    });
    if (res.success && res.conversation) {
      setSelectedConvId(res.conversation.id);
      setSidebarFilter('active');
      setShowNewChatModal(false);
      setShowMobileThread(true);
      setReplyToMsg(null);
    } else {
      showToast(res.error || 'تعذّر بدء المحادثة.', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validated = await readAndValidateAttachment(file);
    if (!validated.success || !validated.attachment) {
      showToast(validated.error || 'الملف غير صالح.', 'error');
      return;
    }
    setAttachment(validated.attachment);
  };

  const handleSend = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    if (!activeConversation) {
      setShowNewChatModal(true);
      return;
    }
    if (!text.trim() && !attachment) return;
    if (pendingSendLockRef.current) return;

    pendingSendLockRef.current = true;
    setIsSendingNow(true);

    const contentToSend = text;
    const attachmentToSend = attachment;
    const replyId = replyToMsg?.id;
    const clientMessageId = `cmsg-stu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // تفريغ حقل الكتابة فوراً مع ضمان تتبع الحالة عبر deliveryStatus في الشات نفسه
    setText('');
    setAttachment(null);
    setReplyToMsg(null);

    try {
      const res = await sendChatMessage({
        conversationId: activeConversation.id,
        studentId: currentStudent.id,
        recipientType: activeConversation.recipientType,
        supervisorId: activeConversation.supervisorId,
        senderType: 'student',
        senderId: currentStudent.id,
        senderName: currentStudent.fullName,
        content: contentToSend,
        attachmentUrl: attachmentToSend?.url,
        attachmentName: attachmentToSend?.name,
        attachmentMimeType: attachmentToSend?.mimeType,
        attachmentSize: attachmentToSend?.sizeBytes,
        attachmentType: attachmentToSend?.type,
        replyToMessageId: replyId,
        clientMessageId,
      });

      if (!res.success && res.error) {
        showToast(res.error, 'warning');
      }
    } finally {
      pendingSendLockRef.current = false;
      setIsSendingNow(false);
    }
  };

  const handleDeleteMessage = (msg: ChatMessage) => {
    const res = softDeleteChatMessage({
      messageId: msg.id,
      deletedById: currentStudent.id,
      deletedByType: 'student',
      deletedByName: currentStudent.fullName,
      reason: 'حذف من الطالب',
    });
    if (!res.success) {
      showToast(res.error || 'تعذّر حذف الرسالة', 'error');
    } else {
      showToast('تم حذف الرسالة مع الاحتفاظ بسجل التدقيق.', 'info');
    }
  };

  const handleScrollMessages = () => {
    const el = messagesContainerRef.current;
    if (el && el.scrollTop < 40 && hasOlderMessages) {
      setVisibleCount((prev) => prev + MESSAGES_PAGE_SIZE);
    }
  };

  const activeEntityInfo = activeConversation ? getConversationEntityInfo(activeConversation) : null;
  const activeConvStatus = activeConversation
    ? CONVERSATION_STATUS_META[activeConversation.status]
    : null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* شريط تنبيه انقطاع الاتصال أو الرسائل المعلقة */}
      {(!isChatOnline || studentQueuedCount > 0) && (
        <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {!isChatOnline
                ? 'أنت غير متصل بالإنترنت حالياً. أي رسالة ترسلها ستُحفظ محلياً لإعادة إرسالها فور عودة الاتصال.'
                : `توجد (${studentQueuedCount}) رسالة معلقة بانتظار إعادة الإرسال.`}
            </span>
          </div>
          {isChatOnline && studentQueuedCount > 0 && (
            <button
              type="button"
              onClick={() => flushChatOutbox()}
              className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              إرسال المعلق الآن
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-card border border-slate-200 overflow-hidden h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-13.5rem)] min-h-[460px] flex relative">
        {/* ================= 1. القائمة الجانبية للمحادثات (Sidebar) ================= */}
        <aside
          className={`w-full md:w-80 lg:w-96 border-l border-slate-200 bg-slate-50/70 flex flex-col shrink-0 ${
            showMobileThread ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header Sidebar */}
          <div className="p-4 bg-white border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-[#3b707d] text-white flex items-center justify-center shadow-sm">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">محادثاتي</h2>
                  <p className="text-[11px] text-slate-500">الإدارة والمشرفون المعتمدون</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="px-3 py-2 rounded-xl bg-[#3b707d] hover:bg-[#315d68] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>محادثة جديدة</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="ابحث باسم المشرف أو نص الرسالة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'active', label: 'المحادثات' },
                  { id: 'unread', label: 'غير مقروءة' },
                  { id: 'archived', label: 'المؤرشفة' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSidebarFilter(tab.id)}
                  className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-colors ${
                    sidebarFilter === tab.id
                      ? 'bg-[#e3ecf3] text-[#2d5762]'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#e3ecf3] text-[#3b707d] mx-auto flex items-center justify-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-800">
                    {sidebarSearch.trim()
                      ? 'لا توجد نتائج مطابقة للبحث'
                      : sidebarFilter === 'archived'
                      ? 'لا توجد محادثات مؤرشفة'
                      : 'لا توجد محادثات في هذه القائمة'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    اضغط على «محادثة جديدة» لاختيار الإدارة أو أحد المشرفين.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#3b707d] text-white text-xs font-bold hover:bg-[#315d68] inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  بدء محادثة جديدة
                </button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const info = getConversationEntityInfo(conv);
                const isSelected = conv.id === activeConversation?.id;
                const statusMeta = CONVERSATION_STATUS_META[conv.status];
                const hasUnread = (conv.unreadCountStudent || 0) > 0;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setSelectedConvId(conv.id);
                      setShowMobileThread(true);
                    }}
                    className={`w-full p-3.5 text-right transition-colors flex items-start gap-3 ${
                      isSelected
                        ? 'bg-[#e3ecf3]/75 border-r-4 border-[#3b707d]'
                        : hasUnread
                        ? 'bg-white hover:bg-[#e3ecf3]/35'
                        : 'hover:bg-white'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 relative ${
                        info.isAdmin
                          ? 'bg-gradient-to-br from-[#3b707d] to-[#264d57] text-white'
                          : 'bg-[#e3ecf3] text-[#3b707d]'
                      }`}
                    >
                      {info.isAdmin ? (
                        <Building2 className="w-5 h-5" />
                      ) : (
                        <UserCheck className="w-5 h-5" />
                      )}
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-900 truncate flex items-center gap-1">
                          {conv.isPinned && <Pin className="w-3 h-3 text-[#3b707d] shrink-0" />}
                          {info.title}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatShortMessageTime(conv.lastMessageAt)}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 truncate mt-0.5">{info.subtitle}</div>

                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p
                          className={`text-[11px] truncate ${
                            hasUnread ? 'font-bold text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {conv.lastMessageContent || 'محادثة جاهزة للبدء...'}
                        </p>

                        <div className="flex items-center gap-1 shrink-0">
                          {hasUnread && (
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                              {conv.unreadCountStudent}
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ================= 2. نافذة المحادثة النشطة ================= */}
        <section
          className={`flex-1 flex flex-col bg-slate-50 min-w-0 ${
            showMobileThread ? 'flex' : 'hidden md:flex'
          }`}
        >
          {!activeConversation || !activeEntityInfo ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center shadow-sm">
                <MessageSquare className="w-9 h-9" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h3 className="text-lg font-black text-slate-900">مرحباً بك في مركز تواصل مكتبة وثبة</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {chatSettings.welcomeMessageText}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="px-6 py-3 rounded-2xl bg-[#3b707d] hover:bg-[#315d68] text-white font-bold text-sm flex items-center gap-2 shadow-soft transition-colors"
              >
                <Plus className="w-4 h-4" />
                اختر جهة المراسلة الآن
              </button>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="bg-gradient-to-l from-[#3b707d] to-[#2c5661] px-4 sm:px-5 py-3.5 text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowMobileThread(false)}
                    className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25"
                    aria-label="العودة للمحادثات"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                    {activeEntityInfo.isAdmin ? (
                      <Building2 className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black truncate">
                        {activeEntityInfo.title}
                      </h3>
                      {activeConvStatus && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                          {activeConvStatus.label}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#e3ecf3] flex items-center gap-2 truncate">
                      <span>{activeEntityInfo.subtitle}</span>
                      {chatSettings.showLastSeen && (
                        <>
                          <span>•</span>
                          <span>{formatLastSeenLabel(activeConversation.staffLastSeenAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setInChatSearchOpen((v) => !v);
                      setInChatSearchQuery('');
                    }}
                    className={`p-2 rounded-xl transition-colors ${
                      inChatSearchOpen ? 'bg-white text-[#3b707d]' : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                    title="بحث داخل المحادثة"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChatPrefs((v) => !v)}
                    className={`p-2 rounded-xl transition-colors ${
                      showChatPrefs ? 'bg-white text-[#3b707d]' : 'bg-white/15 hover:bg-white/25 text-white'
                    }`}
                    title="تفضيلات التنبيهات والخصوصية"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search inside conversation bar */}
              {inChatSearchOpen && (
                <div className="px-4 py-2.5 bg-[#e3ecf3]/60 border-b border-slate-200 flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#3b707d] shrink-0" />
                  <input
                    type="text"
                    value={inChatSearchQuery}
                    onChange={(e) => setInChatSearchQuery(e.target.value)}
                    placeholder="ابحث داخل رسائل هذه المحادثة..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[#3b707d]"
                    autoFocus
                  />
                  {inChatSearchQuery && (
                    <span className="text-[11px] font-bold text-[#3b707d]">
                      {displayedMessages.length} نتيجة
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setInChatSearchOpen(false);
                      setInChatSearchQuery('');
                    }}
                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Chat Privacy & Notification Prefs Drawer */}
              {showChatPrefs && (
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={chatSettings.enableSound}
                        onChange={(e) => updateChatSettings({ enableSound: e.target.checked })}
                        className="rounded text-[#3b707d]"
                      />
                      <span>تشغيل صوت الإشعار</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={chatSettings.showLastSeen}
                        onChange={(e) => updateChatSettings({ showLastSeen: e.target.checked })}
                        className="rounded text-[#3b707d]"
                      />
                      <span>عرض حالة آخر ظهور</span>
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        const perm = await requestBrowserNotificationPermission();
                        updateChatSettings({ enableBrowserNotifications: perm === 'granted' });
                        showToast(
                          perm === 'granted'
                            ? 'تم تفعيل إشعارات المتصفح.'
                            : 'يرجى السماح بالإشعارات من المتصفح.',
                          perm === 'granted' ? 'success' : 'warning'
                        );
                      }}
                      className="px-2.5 py-1 rounded-xl bg-[#e3ecf3] text-[#2c5661] font-bold flex items-center gap-1"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>
                        {chatSettings.enableBrowserNotifications
                          ? 'إشعارات المتصفح مفعّلة'
                          : 'تفعيل إشعارات المتصفح'}
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChatPrefs(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    إغلاق
                  </button>
                </div>
              )}

              {/* Messages Feed */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScrollMessages}
                className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#f6f9fa] bg-[radial-gradient(#3b707d_0.85px,transparent_0.85px)] [background-size:22px_22px]"
              >
                {/* Load older messages */}
                {hasOlderMessages && (
                  <div className="flex justify-center pb-2">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + MESSAGES_PAGE_SIZE)}
                      className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-[#3b707d] text-xs font-bold shadow-sm hover:bg-[#e3ecf3]/50 flex items-center gap-1"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      تحميل رسائل أقدم ({allConversationMessages.length - visibleCount} رسالة سابقة)
                    </button>
                  </div>
                )}

                {allConversationMessages.length === 0 && (
                  <div className="bg-[#e3ecf3]/65 border border-[#3b707d]/20 rounded-2xl p-4 text-center space-y-1.5 max-w-lg mx-auto my-6">
                    <Sparkles className="w-5 h-5 text-[#3b707d] mx-auto" />
                    <p className="text-xs font-black text-[#2c5661]">
                      محادثة خاصة مع {activeEntityInfo.title}
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {chatSettings.welcomeMessageText}
                    </p>
                  </div>
                )}

                {displayedMessages.map((msg, idx) => {
                  const prevMsg = idx > 0 ? displayedMessages[idx - 1] : null;
                  const showDateDivider =
                    !prevMsg ||
                    formatMessageDateDivider(msg.createdAt) !==
                      formatMessageDateDivider(prevMsg.createdAt);
                  const repliedMsg = msg.replyToMessageId
                    ? allConversationMessages.find((m) => m.id === msg.replyToMessageId)
                    : undefined;
                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <ChatDateSeparator dateText={formatMessageDateDivider(msg.createdAt)} />
                      )}
                      <ChatMessageBubble
                        message={msg}
                        isOwnMessage={msg.senderType === 'student'}
                        currentUserId={currentStudent?.id}
                        repliedMessage={repliedMsg}
                        searchQuery={inChatSearchQuery}
                        canDelete={msg.senderType === 'student'}
                        onReply={(target) => setReplyToMsg(target)}
                        onDelete={handleDeleteMessage}
                        onRetry={(msgId) => retryChatMessage(msgId)}
                        onPreviewImage={(url, name) => setLightboxImage({ url, name })}
                        onReact={(emoji: string) =>
                          currentStudent?.id &&
                          toggleMessageReaction(msg.id, emoji, currentStudent.id)
                        }
                      />
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Sticky Composer */}
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0 space-y-2.5">
                {/* Quick Emoji bar for student */}
                <div className="flex items-center gap-1 px-1 overflow-x-auto scrollbar-thin">
                  <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-1">تعبيرات:</span>
                  {['👋', '👍', '❤️', '👏', '📚', '⭐', '❓', '🌸'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setText((prev) => `${prev} ${emoji} `)}
                      className="w-7 h-7 rounded-lg hover:bg-[#e3ecf3]/50 flex items-center justify-center text-sm transition-transform active:scale-90"
                      title={`إضافة ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {!activeEntityInfo.isSupervisorActive && !activeEntityInfo.isAdmin && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-bold flex items-center justify-between gap-2">
                    <span>حساب هذا المشرف غير مفعّل حالياً، يمكنك فتح محادثة جديدة مع الإدارة أو مشرف آخر.</span>
                    <button
                      type="button"
                      onClick={() => setShowNewChatModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-[#3b707d] text-white shrink-0"
                    >
                      محادثة جديدة
                    </button>
                  </div>
                )}

                {replyToMsg && (
                  <div className="flex items-center justify-between gap-2 bg-[#e3ecf3]/70 border-r-4 border-[#3b707d] rounded-xl px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-black text-[#2c5661] flex items-center gap-1 text-[11px]">
                        <Reply className="w-3 h-3" />
                        الرد على: {replyToMsg.senderName}
                      </div>
                      <p className="text-slate-600 truncate text-[11px]">
                        {replyToMsg.content || replyToMsg.attachmentName || 'مرفق'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyToMsg(null)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {attachment && (
                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt="preview"
                          className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-[#3b707d] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">{attachment.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {(attachment.sizeBytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="text-rose-600 font-bold text-xs px-2 py-1 hover:bg-rose-50 rounded-lg"
                    >
                      إزالة
                    </button>
                  </div>
                )}

                <form onSubmit={handleSend} className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-[#e3ecf3] text-slate-600 hover:text-[#3b707d] transition-colors shrink-0"
                    title="إرفاق صورة أو ملف PDF"
                    aria-label="إرفاق ملف"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <textarea
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                    placeholder={`اكتب رسالتك إلى ${activeEntityInfo.title}...`}
                    className="flex-1 min-h-[44px] bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#3b707d] focus:bg-white outline-none resize-none max-h-28"
                  />

                  <button
                    type="submit"
                    disabled={isSendingNow || (!text.trim() && !attachment)}
                    className="min-w-[44px] min-h-[44px] px-4 sm:px-5 rounded-2xl bg-[#3b707d] hover:bg-[#2c5661] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-45 shrink-0 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">إرسال</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ================= نافذة اختيار جهة المراسلة («محادثة جديدة») ================= */}
      {showNewChatModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowNewChatModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-gradient-to-l from-[#3b707d] to-[#2c5661] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black">لمن تريد إرسال رسالتك؟</h3>
                <p className="text-xs text-[#e3ecf3] mt-0.5">
                  اختر الجهة التي ترغب بمراسلتها بشكل خاص وآمن
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* 1. مراسلة الإدارة */}
              <div>
                <span className="text-[11px] font-black text-slate-500 block mb-2">
                  1. التواصل مع إدارة المكتبة
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectRecipient('admin')}
                  className="w-full p-4 rounded-2xl border-2 border-[#3b707d]/25 bg-[#e3ecf3]/45 hover:bg-[#e3ecf3] hover:border-[#3b707d] transition-all text-right flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#3b707d] text-white flex items-center justify-center shadow-sm shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-900">إدارة المكتبة</div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        رسالة خاصة مباشرة إلى صندوق وارد الإدارة للاستفسارات والاقتراحات والاعتمادات.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#3b707d] rotate-180 shrink-0 group-hover:-translate-x-1 transition-transform" />
                </button>
              </div>

              {/* 2. مراسلة مشرف محدد */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-slate-500">
                    2. مراسلة مشرف محدد (المشرفون المفعّلون فقط)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {activeSupervisors.length} مشرف متاح
                  </span>
                </div>

                {activeSupervisors.length === 0 ? (
                  <div className="p-5 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    لا يوجد مشرفون مفعّلون متاحون حالياً، يمكنك مراسلة «إدارة المكتبة» مباشرة.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeSupervisors.map((sup) => (
                      <button
                        key={sup.id}
                        type="button"
                        onClick={() => handleSelectRecipient('supervisor', sup.id)}
                        className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-[#3b707d] hover:bg-[#e3ecf3]/35 transition-all text-right flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-[#e3ecf3] text-[#3b707d] font-black text-sm flex items-center justify-center shrink-0">
                            {sup.fullName.trim().slice(0, 1)}
                          </div>
                          <div>
                            <div className="text-xs sm:text-sm font-black text-slate-900">
                              {sup.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span>مشرف المكتبة</span>
                              {sup.assignedGroups && sup.assignedGroups.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                                  المجموعات: {sup.assignedGroups.join('، ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#3b707d] shrink-0">
                          بدء المحادثة ←
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox preview for images */}
      <ImageLightboxModal image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
};
