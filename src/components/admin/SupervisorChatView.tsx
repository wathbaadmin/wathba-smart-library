import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { ChatMessage, Conversation, ConversationStatus } from '../../types';
import { getLoanCountdown } from '../../lib/dateUtils';
import {
  MessageSquare,
  Send,
  Search,
  User,
  BookOpen,
  ArrowLeftRight,
  Info,
  Pin,
  Flag,
  Archive,
  CheckCircle2,
  RotateCcw,
  Forward,
  Paperclip,
  X,
  ChevronRight,
  ChevronUp,
  Reply,
  WifiOff,
  RefreshCw,
  Building2,
  ShieldCheck,
  FileText,
  Eye,
  Award,
  Sparkles,
  Calendar,
  Copy,
  Check,
  Smile,
} from 'lucide-react';
import {
  CONVERSATION_STATUS_META,
  ChatMessageBubble,
  ImageLightboxModal,
  ChatDateSeparator,
  formatMessageDateDivider,
  formatLastSeenLabel,
  formatShortMessageTime,
} from '../common/ChatSharedComponents';
import { readAndValidateAttachment } from '../../lib/chatService';

interface SupervisorChatViewProps {
  initialConversationId?: string;
  onConversationOpened?: () => void;
  initialInboxMode?: 'my_inbox' | 'oversight';
}

const MESSAGES_PAGE_SIZE = 30;

export const SupervisorChatView: React.FC<SupervisorChatViewProps> = ({
  initialConversationId,
  onConversationOpened,
  initialInboxMode = 'my_inbox',
}) => {
  const { currentStaff } = useAuth();
  const {
    staff,
    conversations,
    messages,
    students,
    loans,
    books,
    copies,
    returnRequests,
    exchangeRequests,
    chatSettings,
    chatOutbox,
    isChatOnline,
    sendChatMessage,
    retryChatMessage,
    flushChatOutbox,
    markConversationAsRead,
    updateConversationPresence,
    updateConversationStatus,
    togglePinConversation,
    toggleFollowUpConversation,
    transferConversationToAdmin,
    softDeleteChatMessage,
    toggleMessageReaction,
    discussions,
    readingRanks,
    studentRanks,
    readingCompletions,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';
  const canViewAllChats = Boolean(isAdmin || liveStaff?.permissions?.can_view_all_chats);
  const canArchiveChats = Boolean(isAdmin || liveStaff?.permissions?.can_manage_chats !== false);

  const [inboxMode, setInboxMode] = useState<'my_inbox' | 'oversight'>(initialInboxMode);

  useEffect(() => {
    setInboxMode(initialInboxMode);
  }, [initialInboxMode]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId || null
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'waiting_reply' | 'follow_up' | 'completed' | 'archived'
  >('all');
  const [showStudentInfoPane, setShowStudentInfoPane] = useState(true);
  const [showMobileThread, setShowMobileThread] = useState(Boolean(initialConversationId));

  // Thread composer & tools
  const [replyText, setReplyText] = useState('');
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
  const [visibleCount, setVisibleCount] = useState(MESSAGES_PAGE_SIZE);
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name?: string } | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferReason, setTransferReason] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pendingSendLockRef = useRef<boolean>(false);

  // عزل صناديق الوارد حسب الدور والصلاحية بدقة
  const scopedConversations = useMemo(() => {
    if (!liveStaff) return [];
    return (conversations || []).filter((c) => {
      if (isAdmin) {
        if (inboxMode === 'my_inbox') {
          return c.recipientType === 'admin';
        }
        return c.recipientType === 'supervisor';
      }
      // المشرف: يرى محادثاته الخاصة فقط ما لم تُمنح له صلاحية الإشراف العام
      if (inboxMode === 'oversight' && canViewAllChats) {
        return true;
      }
      return c.recipientType === 'supervisor' && c.supervisorId === liveStaff.id;
    });
  }, [canViewAllChats, conversations, inboxMode, isAdmin, liveStaff]);

  const filteredConversations = useMemo(() => {
    return scopedConversations
      .filter((c) => {
        const isArchived = Boolean(c.isArchived || c.status === 'archived');
        if (statusFilter === 'archived' && !isArchived) return false;
        if (statusFilter !== 'archived' && isArchived) return false;
        if (statusFilter === 'waiting_reply' && c.status !== 'waiting_reply') return false;
        if (statusFilter === 'follow_up' && !c.isFollowUp) return false;
        if (statusFilter === 'completed' && c.status !== 'completed') return false;

        if (searchTerm.trim()) {
          const q = searchTerm.trim().toLowerCase();
          const st = students.find((s) => s.id === c.studentId);
          const matchStudent =
            (st?.fullName || '').toLowerCase().includes(q) ||
            (st?.internalId || '').toLowerCase().includes(q) ||
            (st?.groupName || '').toLowerCase().includes(q);
          const matchMsg = (c.lastMessageContent || '').toLowerCase().includes(q);
          return matchStudent || matchMsg;
        }
        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
  }, [scopedConversations, searchTerm, statusFilter, students]);

  // فتح المحادثة القادمة من إشعار وضبط الصندوق المناسب تلقائياً
  useEffect(() => {
    if (!initialConversationId) return;
    const targetConv = (conversations || []).find((c) => c.id === initialConversationId);
    if (targetConv && liveStaff) {
      if (isAdmin) {
        setInboxMode(targetConv.recipientType === 'admin' ? 'my_inbox' : 'oversight');
      } else if (targetConv.supervisorId !== liveStaff.id && canViewAllChats) {
        setInboxMode('oversight');
      } else {
        setInboxMode('my_inbox');
      }
      if (targetConv.isArchived || targetConv.status === 'archived') {
        setStatusFilter('archived');
      }
      setSelectedConversationId(targetConv.id);
      setShowMobileThread(true);
      onConversationOpened?.();
    }
  }, [canViewAllChats, conversations, initialConversationId, isAdmin, liveStaff, onConversationOpened]);

  // اختيار أول محادثة متاحة عند عدم وجود تحديد (دون مسح محادثة الإشعارات أثناء تبديل الصندوق)
  useEffect(() => {
    if (initialConversationId) return;
    if (selectedConversationId) {
      const stillVisible = scopedConversations.some((c) => c.id === selectedConversationId);
      if (stillVisible) return;
      // إذا كانت المحادثة المحددة موجودة في صندوق آخر أثناء التبديل الفوري انتظر استقرار التبديل
      const existsInOtherInbox = (conversations || []).some((c) => c.id === selectedConversationId);
      if (existsInOtherInbox && !isAdmin && !canViewAllChats) {
        setSelectedConversationId(null);
      } else if (existsInOtherInbox) {
        return;
      }
    }
    if (filteredConversations.length > 0) {
      setSelectedConversationId(filteredConversations[0].id);
    } else {
      setSelectedConversationId(null);
    }
  }, [
    canViewAllChats,
    conversations,
    filteredConversations,
    initialConversationId,
    isAdmin,
    scopedConversations,
    selectedConversationId,
  ]);

  const activeConv = useMemo(
    () => scopedConversations.find((c) => c.id === selectedConversationId) || null,
    [scopedConversations, selectedConversationId]
  );

  const activeStudent = useMemo(
    () => (activeConv ? students.find((s) => s.id === activeConv.studentId) || null : null),
    [activeConv, students]
  );

  const allConversationMessages = useMemo(() => {
    if (!activeConv) return [];
    return (messages || [])
      .filter((m) => m.conversationId === activeConv.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeConv, messages]);

  const displayedMessages = useMemo(() => {
    if (inChatSearchQuery.trim()) {
      const q = inChatSearchQuery.trim().toLowerCase();
      return allConversationMessages.filter(
        (m) =>
          !m.isDeleted &&
          (m.content.toLowerCase().includes(q) || (m.attachmentName || '').toLowerCase().includes(q))
      );
    }
    const startIdx = Math.max(0, allConversationMessages.length - visibleCount);
    return allConversationMessages.slice(startIdx);
  }, [allConversationMessages, inChatSearchQuery, visibleCount]);

  const hasOlderMessages =
    !inChatSearchQuery.trim() && allConversationMessages.length > visibleCount;

  const readerRole: 'admin' | 'supervisor' = isAdmin ? 'admin' : 'supervisor';

  // هل يقرأ الموظف بصفته المستهدف الأصلي أم مشرف عام للمتابعة فقط؟
  const isReadOnlyOversight = Boolean(
    activeConv &&
      ((isAdmin && activeConv.recipientType === 'supervisor') ||
        (!isAdmin && activeConv.supervisorId !== liveStaff?.id))
  );

  useEffect(() => {
    if (!activeConv || !liveStaff) return;
    setVisibleCount(MESSAGES_PAGE_SIZE);
    if (!isReadOnlyOversight) {
      markConversationAsRead(activeConv.id, readerRole);
      updateConversationPresence(activeConv.id, 'staff');
    }
  }, [activeConv?.id, isReadOnlyOversight, liveStaff?.id]);

  useEffect(() => {
    if (!activeConv || isReadOnlyOversight) return;
    if ((activeConv.unreadCountSupervisor || 0) > 0) {
      markConversationAsRead(activeConv.id, readerRole);
    }
  }, [activeConv?.id, activeConv?.unreadCountSupervisor, allConversationMessages.length, isReadOnlyOversight]);

  useEffect(() => {
    if (!inChatSearchQuery.trim()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allConversationMessages.length, activeConv?.id]);

  if (!liveStaff) return null;

  const staffQueuedCount = chatOutbox.filter((q) => q.senderId === liveStaff.id).length;

  const activeStudentLoans = activeStudent
    ? loans.filter((l) => l.studentId === activeStudent.id && l.status === 'active')
    : [];
  const activeStudentReturnReqs = activeStudent
    ? returnRequests.filter(
        (r) =>
          r.studentId === activeStudent.id &&
          !['completed', 'cancelled', 'rejected'].includes(r.status)
      )
    : [];
  const activeStudentExchangeReqs = activeStudent
    ? exchangeRequests.filter(
        (e) =>
          e.studentId === activeStudent.id &&
          !['completed', 'cancelled', 'rejected'].includes(e.status)
      )
    : [];

  const activeStudentCompletions = useMemo(() => {
    if (!activeStudent) return [];
    return (readingCompletions || []).filter((c) => c.studentId === activeStudent.id);
  }, [readingCompletions, activeStudent]);

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

  const handleSendReply = async (e?: React.FormEvent | React.KeyboardEvent) => {
    e?.preventDefault();
    if (!activeConv || !activeStudent) return;
    if (!replyText.trim() && !attachment) return;
    if (pendingSendLockRef.current) return;

    pendingSendLockRef.current = true;
    setIsSendingNow(true);

    const contentToSend = replyText;
    const attachmentToSend = attachment;
    const replyId = replyToMsg?.id;
    const clientMessageId = `cmsg-stf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setReplyText('');
    setAttachment(null);
    setReplyToMsg(null);

    const senderDisplayName =
      liveStaff.role === 'admin'
        ? `${liveStaff.fullName} (إدارة المكتبة)`
        : `${liveStaff.fullName} (مشرف المكتبة)`;

    try {
      const res = await sendChatMessage({
        conversationId: activeConv.id,
        studentId: activeStudent.id,
        recipientType: activeConv.recipientType,
        supervisorId: activeConv.supervisorId,
        senderType: liveStaff.role === 'admin' ? 'admin' : 'supervisor',
        senderId: liveStaff.id,
        senderName: senderDisplayName,
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

  const handleStatusChange = (status: ConversationStatus) => {
    if (!activeConv) return;
    if (status === 'archived' && !canArchiveChats) {
      showToast('لا تملك صلاحية أرشفة المحادثات.', 'error');
      return;
    }
    const res = updateConversationStatus({
      conversationId: activeConv.id,
      status,
      actorId: liveStaff.id,
      actorType: isAdmin ? 'admin' : 'supervisor',
      actorName: liveStaff.fullName,
    });
    if (res.success) {
      showToast(`تم تحديث حالة المحادثة إلى: ${CONVERSATION_STATUS_META[status].label}`, 'success');
    } else {
      showToast(res.error || 'تعذّر تحديث الحالة', 'error');
    }
  };

  const handleConfirmTransferToAdmin = () => {
    if (!activeConv) return;
    const res = transferConversationToAdmin({
      conversationId: activeConv.id,
      fromStaffId: liveStaff.id,
      fromStaffName: liveStaff.fullName,
      fromRole: isAdmin ? 'admin' : 'supervisor',
      reason: transferReason.trim() || undefined,
    });
    if (res.success) {
      showToast('تم تحويل المحادثة إلى صندوق وارد الإدارة مع إشعار الإدارة وتوثيق السجل.', 'success');
      setTransferModalOpen(false);
      setTransferReason('');
    } else {
      showToast(res.error || 'تعذّر تحويل المحادثة', 'error');
    }
  };

  const handleDeleteMessage = (msg: ChatMessage) => {
    const canDeleteThis = isAdmin || msg.senderId === liveStaff.id || canArchiveChats;
    if (!canDeleteThis) {
      showToast('لا تملك صلاحية حذف هذه الرسالة.', 'error');
      return;
    }
    const res = softDeleteChatMessage({
      messageId: msg.id,
      deletedById: liveStaff.id,
      deletedByType: isAdmin ? 'admin' : 'supervisor',
      deletedByName: liveStaff.fullName,
      reason: 'حذف إداري ناعم مع حفظ سجل التدقيق',
    });
    if (res.success) {
      showToast('تم حذف الرسالة مع حفظ الأثر في سجل الرقابة.', 'info');
    } else {
      showToast(res.error || 'تعذّر حذف الرسالة', 'error');
    }
  };

  const handleScrollMessages = () => {
    const el = messagesContainerRef.current;
    if (el && el.scrollTop < 40 && hasOlderMessages) {
      setVisibleCount((prev) => prev + MESSAGES_PAGE_SIZE);
    }
  };

  const [copiedCode, setCopiedCode] = useState(false);
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const activeStudentRankTitle = useMemo(() => {
    if (!activeStudent) return 'قارئ مستجد';
    const ach = (studentRanks || []).find((sr) => sr.studentId === activeStudent.id);
    if (ach) {
      const def = (readingRanks || []).find((r) => r.id === ach.rankId);
      if (def) return def.title;
    }
    const read = activeStudent.totalBooksRead || 0;
    const sorted = [...(readingRanks || [])].sort((a, b) => b.requiredPages - a.requiredPages);
    const matched = sorted.find((r) => read * 50 >= r.requiredPages);
    return matched ? matched.title : 'قارئ مستجد';
  }, [activeStudent, readingRanks, studentRanks]);

  const activeStudentDiscussions = useMemo(() => {
    if (!activeStudent) return [];
    return (discussions || []).filter((d) => d.studentId === activeStudent.id);
  }, [activeStudent, discussions]);

  const quickTemplates = [
    { icon: '👋', label: 'ترحيب واستقبال', text: 'وعليكم السلام ورحمة الله، تفضل بمراجعة المكتبة وسأكون بانتظارك بإذن الله.' },
    { icon: '📚', label: 'توفر الكتاب', text: 'تم التحقق من الكتاب وهو متاح الآن وجاهز للاستلام من قسم الإعارة بالمكتبة.' },
    { icon: '📅', label: 'موعد المناقشة', text: 'أهلاً بك، تم استلام طلبك ويسعدنا تنسيق جلسة مناقشة ممتعة ومثرية قريباً.' },
    { icon: '⭐', label: 'تشجيع وإشادة', text: 'بارك الله في همتك القرائية ونشاطك المتميز في مكتبة مداد! استمر في القراءة.' },
    { icon: '⏳', label: 'متابعة قيد الإجراء', text: 'تم استلام استفسارك ومتابعته، وسنوافيك بالرد والإفادة في أقرب وقت.' },
    { icon: '📖', label: 'تمديد الإعارة', text: 'يمكنك طلب تمديد الإعارة مباشرة من صفحة إعاراتك قبل انتهاء المدة بيومين.' },
  ];

  const quickEmojis = ['👍', '❤️', '👏', '📚', '⭐', '💡', '✅', '🎯'];

  const myInboxUnreadCount = (conversations || [])
    .filter((c) => {
      if (c.isArchived || c.status === 'archived') return false;
      return isAdmin
        ? c.recipientType === 'admin'
        : c.recipientType === 'supervisor' && c.supervisorId === liveStaff.id;
    })
    .reduce((sum, c) => sum + (c.unreadCountSupervisor || 0), 0);

  const oversightUnreadCount = (conversations || [])
    .filter((c) => {
      if (c.isArchived || c.status === 'archived') return false;
      return isAdmin ? c.recipientType === 'supervisor' : c.supervisorId !== liveStaff.id;
    })
    .reduce((sum, c) => sum + (c.unreadCountSupervisor || 0), 0);

  return (
    <div className="space-y-4">
      {/* Offline / Outbox Banner */}
      {(!isChatOnline || staffQueuedCount > 0) && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {!isChatOnline
                ? 'الاتصال بالشبكة منقطع حالياً — تُحفظ الردود محلياً لإعادة إرسالها تلقائياً فور عودة الاتصال.'
                : `توجد (${staffQueuedCount}) رسالة بانتظار إعادة الإرسال.`}
            </span>
          </div>
          {isChatOnline && staffQueuedCount > 0 && (
            <button
              type="button"
              onClick={() => flushChatOutbox()}
              className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              إعادة إرسال المعلق
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-card border border-slate-200 overflow-hidden h-[calc(100dvh-10.5rem)] lg:h-[calc(100dvh-12rem)] min-h-[480px] grid grid-cols-1 lg:grid-cols-12">
        {/* ================= 1. العمود الأيمن: صندوق الوارد المعزول والفلترة ================= */}
        <aside
          className={`lg:col-span-4 xl:col-span-3 border-l border-slate-200 flex flex-col bg-slate-50/70 ${
            showMobileThread ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Inbox header & scope switch */}
          <div className="p-3.5 bg-white border-b border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#3b707d] text-white flex items-center justify-center">
                  {isAdmin ? <Building2 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-900">
                    {isAdmin ? 'صندوق وارد الإدارة' : 'صندوق وارد المشرف'}
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    {isAdmin ? 'المحادثات الموجهة لإدارة المكتبة' : `خاص بـ ${liveStaff.fullName}`}
                  </p>
                </div>
              </div>
            </div>

            {/* زر التبديل للإشراف فقط لمن يملك صلاحية الإدارة أو المتابعة */}
            {(isAdmin || canViewAllChats) && (
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setInboxMode('my_inbox')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                    inboxMode === 'my_inbox'
                      ? 'bg-[#3b707d] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{isAdmin ? 'وارد الإدارة' : 'محادثاتي'}</span>
                  {myInboxUnreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px]">
                      {myInboxUnreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setInboxMode('oversight')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                    inboxMode === 'oversight'
                      ? 'bg-[#3b707d] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>إشراف المشرفين</span>
                  {oversightUnreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px]">
                      {oversightUnreadCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث باسم الطالب، الرقم، المجموعة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'waiting_reply', label: 'بانتظار الرد' },
                  { id: 'follow_up', label: 'للمتابعة' },
                  { id: 'completed', label: 'مكتملة' },
                  { id: 'archived', label: 'الأرشيف' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-[#e3ecf3] text-[#2c5661]'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                <MessageSquare className="w-7 h-7 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-600">لا توجد محادثات في هذا القسم</p>
                <p className="text-[11px]">
                  {inboxMode === 'my_inbox'
                    ? 'ستظهر هنا الرسائل الواردة إلى صندوقك فقط فور إرسال الطلاب.'
                    : 'لا توجد محادثات للمتابعة ضمن هذا التصنيف.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const st = students.find((s) => s.id === conv.studentId);
                if (!st) return null;
                const isSelected = conv.id === activeConv?.id;
                const hasUnread = (conv.unreadCountSupervisor || 0) > 0;
                const statusMeta = CONVERSATION_STATUS_META[conv.status];
                const assignedSupervisor =
                  conv.recipientType === 'supervisor'
                    ? staff.find((s) => s.id === conv.supervisorId)
                    : null;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversationId(conv.id);
                      setShowMobileThread(true);
                    }}
                    className={`w-full p-3.5 text-right transition-colors flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-[#e3ecf3]/75 border-r-4 border-[#3b707d]'
                        : hasUnread
                        ? 'bg-white hover:bg-[#e3ecf3]/35'
                        : 'hover:bg-white'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 relative ${
                        hasUnread
                          ? 'bg-[#3b707d] text-white'
                          : 'bg-[#e3ecf3] text-[#3b707d]'
                      }`}
                    >
                      {st.fullName.slice(0, 1)}
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="font-black text-xs text-slate-900 truncate flex items-center gap-1">
                          {conv.isPinned && <Pin className="w-3 h-3 text-[#3b707d] shrink-0" />}
                          {conv.isFollowUp && <Flag className="w-3 h-3 text-amber-500 shrink-0" />}
                          {st.fullName}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatShortMessageTime(conv.lastMessageAt)}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                        <span>{st.grade} • {st.groupName}</span>
                        {inboxMode === 'oversight' && assignedSupervisor && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-bold">
                            المشرف: {assignedSupervisor.fullName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p
                          className={`text-[11px] truncate ${
                            hasUnread ? 'font-bold text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {conv.lastMessageContent || 'محادثة جديدة'}
                        </p>

                        <div className="flex items-center gap-1 shrink-0">
                          {hasUnread && (
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                              {conv.unreadCountSupervisor}
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

        {/* ================= 2. العمود الأوسط: نافذة المحادثة والرد ================= */}
        <section
          className={`flex-col bg-slate-50 min-w-0 ${
            showStudentInfoPane ? 'lg:col-span-5 xl:col-span-6' : 'lg:col-span-8 xl:col-span-9'
          } ${showMobileThread ? 'flex' : 'hidden lg:flex'}`}
        >
          {activeConv && activeStudent ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 sm:px-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowMobileThread(false)}
                    className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 text-slate-700"
                    aria-label="العودة للقائمة"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center font-black text-sm shrink-0">
                    {activeStudent.fullName.slice(0, 1)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm text-slate-900 truncate">
                        {activeStudent.fullName}
                      </h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                          CONVERSATION_STATUS_META[activeConv.status].badgeClass
                        }`}
                      >
                        {CONVERSATION_STATUS_META[activeConv.status].label}
                      </span>
                      {activeConv.recipientType === 'admin' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3b707d]/10 text-[#3b707d] font-bold">
                          موجهة للإدارة
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          مشرف محدد
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate mt-0.5">
                      <span>{activeStudent.grade} • {activeStudent.groupName}</span>
                      {chatSettings.showLastSeen && (
                        <>
                          <span>•</span>
                          <span>{formatLastSeenLabel(activeConv.studentLastSeenAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Staff Controls */}
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      togglePinConversation(activeConv.id, liveStaff.id, liveStaff.fullName)
                    }
                    className={`p-2 rounded-xl border text-xs transition-colors ${
                      activeConv.isPinned
                        ? 'bg-[#e3ecf3] border-[#3b707d] text-[#3b707d]'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                    title={activeConv.isPinned ? 'إلغاء التثبيت' : 'تثبيت المحادثة'}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      toggleFollowUpConversation(activeConv.id, liveStaff.id, liveStaff.fullName)
                    }
                    className={`p-2 rounded-xl border text-xs transition-colors ${
                      activeConv.isFollowUp
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                    title={activeConv.isFollowUp ? 'إزالة علامة المتابعة' : 'تحديد للمتابعة'}
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInChatSearchOpen((v) => !v);
                      setInChatSearchQuery('');
                    }}
                    className={`p-2 rounded-xl border text-xs transition-colors ${
                      inChatSearchOpen
                        ? 'bg-[#e3ecf3] border-[#3b707d] text-[#3b707d]'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                    title="بحث داخل المحادثة"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>

                  {activeConv.recipientType === 'supervisor' && (
                    <button
                      type="button"
                      onClick={() => setTransferModalOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#e3ecf3] text-slate-700 hover:text-[#2c5661] text-[11px] font-bold flex items-center gap-1 transition-colors"
                      title="تحويل المحادثة إلى إدارة المكتبة"
                    >
                      <Forward className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">تحويل للإدارة</span>
                    </button>
                  )}

                  {activeConv.status !== 'completed' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('completed')}
                      className="px-2.5 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 transition-colors"
                      title="إغلاق وتحديد كمكتملة"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">إكمال</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('open')}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1 transition-colors"
                      title="إعادة فتح المحادثة"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden xl:inline">إعادة فتح</span>
                    </button>
                  )}

                  {canArchiveChats && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          activeConv.status === 'archived' ? 'open' : 'archived'
                        )
                      }
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-700 transition-colors"
                      title={
                        activeConv.status === 'archived' ? 'إلغاء الأرشفة' : 'أرشفة المحادثة'
                      }
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowStudentInfoPane((v) => !v)}
                    className={`hidden lg:flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl font-bold transition-colors ${
                      showStudentInfoPane
                        ? 'bg-[#e3ecf3] text-[#2c5661]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>بيانات الطالب</span>
                  </button>
                </div>
              </div>

              {/* Search Inside Conversation Bar */}
              {inChatSearchOpen && (
                <div className="px-4 py-2 bg-[#e3ecf3]/60 border-b border-slate-200 flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#3b707d] shrink-0" />
                  <input
                    type="text"
                    value={inChatSearchQuery}
                    onChange={(e) => setInChatSearchQuery(e.target.value)}
                    placeholder="ابحث في نص الرسائل..."
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

              {/* Read-only notice when viewing another supervisor's chat under oversight */}
              {isReadOnlyOversight && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11px] text-amber-900 font-bold flex items-center justify-between gap-2">
                  <span>
                    وضع المتابعة والإشراف: هذه المحادثة موجهة لمشرف محدد (
                    {staff.find((s) => s.id === activeConv.supervisorId)?.fullName || 'مشرف المكتبة'}).
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setTransferModalOpen(true)}
                      className="px-2.5 py-1 rounded-lg bg-[#3b707d] text-white text-[10px]"
                    >
                      سحب إلى صندوق الإدارة
                    </button>
                  )}
                </div>
              )}

              {/* Messages Feed */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScrollMessages}
                className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-[#f6f9fa] bg-[radial-gradient(#3b707d_0.85px,transparent_0.85px)] [background-size:22px_22px]"
              >
                {hasOlderMessages && (
                  <div className="flex justify-center pb-2">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + MESSAGES_PAGE_SIZE)}
                      className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-[#3b707d] text-xs font-bold shadow-sm hover:bg-[#e3ecf3]/50 flex items-center gap-1"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      عرض رسائل أقدم ({allConversationMessages.length - visibleCount})
                    </button>
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
                  const isStaffMsg = msg.senderType === 'supervisor' || msg.senderType === 'admin';
                  return (
                    <React.Fragment key={msg.id}>
                      {showDateDivider && (
                        <ChatDateSeparator dateText={formatMessageDateDivider(msg.createdAt)} />
                      )}
                      <ChatMessageBubble
                        message={msg}
                        isOwnMessage={isStaffMsg}
                        currentUserId={liveStaff?.id}
                        repliedMessage={repliedMsg}
                        searchQuery={inChatSearchQuery}
                        canDelete={isAdmin || msg.senderId === liveStaff.id || canArchiveChats}
                        onReply={(target) => setReplyToMsg(target)}
                        onDelete={handleDeleteMessage}
                        onRetry={(msgId) => retryChatMessage(msgId)}
                        onPreviewImage={(url, name) => setLightboxImage({ url, name })}
                        onReact={(emoji: string) => liveStaff?.id && toggleMessageReaction(msg.id, emoji, liveStaff.id)}
                      />
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Sticky Composer */}
              <div className="p-3 bg-white border-t border-slate-200 space-y-2.5 shrink-0">
                {/* Quick templates */}
                {!isReadOnlyOversight && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    <span className="text-[10px] text-slate-400 font-bold px-1 shrink-0 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#3b707d]" />
                      ردود سريعة:
                    </span>
                    {quickTemplates.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReplyText((prev) => (prev ? `${prev} ${tmpl.text}` : tmpl.text))}
                        className="text-[11px] px-2.5 py-1 rounded-xl bg-[#e3ecf3]/70 hover:bg-[#e3ecf3] text-[#2c5661] border border-[#3b707d]/20 whitespace-nowrap shrink-0 font-bold transition-all shadow-xs flex items-center gap-1 hover:border-[#3b707d]/40"
                        title={tmpl.text}
                      >
                        <span>{tmpl.icon}</span>
                        <span>{tmpl.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Emoji Strip */}
                {!isReadOnlyOversight && (
                  <div className="flex items-center justify-between px-1 text-xs">
                    <div className="flex items-center gap-1 overflow-x-auto">
                      <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-1">تعبيرات سريعة:</span>
                      {quickEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setReplyText((prev) => `${prev} ${emoji} `)}
                          className="w-7 h-7 rounded-lg hover:bg-[#e3ecf3]/50 flex items-center justify-center text-sm transition-transform active:scale-90"
                          title={`إضافة ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {replyToMsg && (
                  <div className="flex items-center justify-between gap-2 bg-[#e3ecf3]/70 border-r-4 border-[#3b707d] rounded-xl px-3 py-1.5 text-xs">
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
                  <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {attachment.type === 'image' ? (
                        <img
                          src={attachment.url}
                          alt="preview"
                          className="w-8 h-8 rounded object-cover"
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-[#3b707d] shrink-0" />
                      )}
                      <span className="truncate font-bold text-slate-800">{attachment.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="text-rose-500 text-xs font-bold px-2 py-0.5"
                    >
                      إلغاء
                    </button>
                  </div>
                )}

                {isReadOnlyOversight ? (
                  <div className="p-2.5 rounded-xl bg-slate-100 text-center text-xs text-slate-600 font-medium">
                    لا يمكن الرد من وضع المتابعة إلا بعد تحويل المحادثة إلى الإدارة أو فتحها من المشرف المعني.
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="flex items-end gap-2">
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
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-[#e3ecf3] text-slate-600 hover:text-[#3b707d] transition-colors shrink-0"
                      title="إرفاق صورة أو ملف"
                      aria-label="إرفاق ملف"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <textarea
                      rows={1}
                      placeholder={`اكتب ردك للطالب ${activeStudent.fullName}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply(e);
                        }
                      }}
                      className="flex-1 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#3b707d] outline-none resize-none max-h-24"
                    />

                    <button
                      type="submit"
                      disabled={isSendingNow || (!replyText.trim() && !attachment)}
                      className="min-w-[44px] min-h-[44px] px-4 rounded-xl bg-[#3b707d] hover:bg-[#2c5661] disabled:opacity-45 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>إرسال</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs gap-2 p-6 text-center">
              <MessageSquare className="w-10 h-10 text-slate-300" />
              <p className="font-bold text-slate-600">اختر محادثة من القائمة لعرض التفاصيل والرد</p>
            </div>
          )}
        </section>

        {/* ================= 3. العمود الثالث: ملف الطالب وإعاراته وطلباته ================= */}
        {showStudentInfoPane && activeStudent && (
          <aside className="hidden lg:flex lg:col-span-3 border-r border-slate-200 flex-col bg-slate-50/80 p-4 space-y-4 overflow-y-auto">
            {/* بطاقة الطالب المتطورة */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 text-right space-y-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#3b707d] to-[#2c5661] text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
                  {activeStudent.fullName.trim().charAt(0) || 'ط'}
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-black text-sm text-slate-900 truncate">
                    {activeStudent.fullName}
                  </h5>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-500 truncate">
                      {activeStudent.groupName || 'المجموعة العامة'}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      {activeStudent.status === 'active' ? 'حساب مفعّل' : 'معلّق'}
                    </span>
                  </div>
                </div>
              </div>

              {/* كود الطالب مع زر النسخ المباشر */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-1.5 font-mono font-bold text-slate-600">
                  <span className="text-slate-400 text-[11px]">معرّف الطالب:</span>
                  <span className="text-[#2c5661]">#{activeStudent.internalId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(activeStudent.internalId)}
                  className="p-1 rounded-lg hover:bg-white text-slate-400 hover:text-[#3b707d] transition-colors"
                  title="نسخ معرّف الطالب"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* شبكة الإحصائيات الأربعة */}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-100 flex flex-col items-center justify-center">
                  <span className="block font-black text-sm text-slate-900">
                    {activeStudent.totalBooksRead}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">كتب مقروءة</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#e3ecf3]/60 border border-[#3b707d]/15 flex flex-col items-center justify-center">
                  <span className="block font-black text-sm text-[#2c5661]">
                    {activeStudentLoans.length}
                  </span>
                  <span className="text-[10px] text-[#3b707d] font-bold">إعارات نشطة</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-1">
                    <Award className="w-3 h-3 text-amber-600" />
                    <span className="font-black text-xs text-amber-900 truncate max-w-[85px]">
                      {activeStudentRankTitle}
                    </span>
                  </div>
                  <span className="text-[9px] text-amber-700/80 font-medium">الرتبة القرائية</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200/60 flex flex-col items-center justify-center">
                  <span className="block font-black text-sm text-purple-900">
                    {activeStudentDiscussions.length}
                  </span>
                  <span className="text-[10px] text-purple-700/80 font-medium">مناقشات قرائية</span>
                </div>
              </div>
            </div>

            {/* الكتب المستعارة حالياً */}
            <div className="space-y-2 text-right">
              <div className="flex items-center justify-between">
                <h6 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#3b707d]" />
                  <span>الكتب المستعارة حالياً</span>
                </h6>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                  {activeStudentLoans.length}
                </span>
              </div>

              {activeStudentLoans.length === 0 ? (
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 space-y-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="font-bold text-slate-700 text-[11px]">لا توجد إعارات نشطة</p>
                  <p className="text-[10px] text-slate-400">سجل الإعارات منتظم لجميع الكتب</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeStudentLoans.map((loan) => {
                    const copy = copies.find((c) => c.id === loan.copyId);
                    const book = books.find((b) => b.id === copy?.bookId);
                    const countdown = getLoanCountdown(loan.dueDate);

                    return (
                      <div
                        key={loan.id}
                        className="p-3 rounded-2xl bg-white border border-slate-200/90 space-y-2 shadow-xs text-right"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {copy?.copyCode || 'نسخة'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full font-black border text-[10px] ${countdown.badgeColorClass}`}
                          >
                            {countdown.label}
                          </span>
                        </div>
                        <h6 className="font-black text-xs text-slate-900 leading-snug line-clamp-1">
                          {book?.title || 'كتاب مستعار'}
                        </h6>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                          <span>تاريخ الاستحقاق:</span>
                          <span className="font-bold text-slate-700">{countdown.hijriDate}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* المناقشات القرائية المجدولة أو المعلقة */}
            {activeStudentDiscussions.length > 0 && (
              <div className="space-y-2 text-right">
                <h6 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-700" />
                  <span>المناقشات القرائية ({activeStudentDiscussions.length})</span>
                </h6>
                <div className="space-y-1.5">
                  {activeStudentDiscussions.slice(0, 3).map((disc) => {
                    const b = books.find((x) => x.id === disc.bookId);
                    const statusMeta: Record<string, { label: string; cls: string }> = {
                      pending: { label: 'بانتظار موعد', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                      scheduled: { label: 'مجدولة', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
                      completed: { label: 'مكتملة', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                      approved: { label: 'معتمدة', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                      needs_rediscussion: { label: 'إعادة مناقشة', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
                    };
                    const m = statusMeta[disc.status] || { label: disc.status, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
                    return (
                      <div
                        key={disc.id}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-right space-y-1 shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-800 truncate max-w-[130px]">
                            {b?.title || 'مناقشة كتاب'}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${m.cls}`}>
                            {m.label}
                          </span>
                        </div>
                        {disc.scheduledDate && (
                          <div className="text-[10px] text-slate-500">
                            الموعد: {disc.scheduledDate}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* الطلبات النشطة (الإرجاع والاستبدال) */}
            <div className="space-y-2 text-right">
              <h6 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
                <span>طلبات الإرجاع والاستبدال</span>
              </h6>

              {activeStudentReturnReqs.length === 0 && activeStudentExchangeReqs.length === 0 ? (
                <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center text-[11px] text-slate-400">
                  لا توجد طلبات جارية
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeStudentReturnReqs.map((req) => (
                    <div
                      key={req.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 text-right space-y-1 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#3b707d]">طلب إرجاع كتاب</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200">
                          {req.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        #{req.id.slice(-6)}
                      </div>
                    </div>
                  ))}

                  {activeStudentExchangeReqs.map((req) => (
                    <div
                      key={req.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 text-right space-y-1 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-purple-800">طلب استبدال كتاب</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold border border-purple-200">
                          {req.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        #{req.id.slice(-6)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* سجل إكمال قراءة الكتب */}
            <div className="space-y-2 text-right">
              <h6 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>سجل إكمال الكتب ({activeStudentCompletions.length})</span>
              </h6>

              {activeStudentCompletions.length === 0 ? (
                <div className="p-3 rounded-2xl bg-white border border-slate-200 text-center text-[11px] text-slate-400">
                  لا توجد طلبات إكمال مسجلة
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeStudentCompletions.slice(0, 4).map((comp) => {
                    const b = books.find((x) => x.id === comp.bookId);
                    const statusMeta: Record<string, { label: string; cls: string }> = {
                      new: { label: 'طلب جديد', cls: 'bg-sky-50 text-sky-800 border-sky-200' },
                      pending_approval: { label: 'بانتظار الاعتماد', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
                      under_review: { label: 'قيد المراجعة', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
                      approved: { label: 'مكتمل ومعتمد', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
                      needs_revision: { label: 'يحتاج استكمال', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
                      rejected: { label: 'مرفوض', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
                    };
                    const m = statusMeta[comp.status] || { label: comp.status, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
                    return (
                      <div
                        key={comp.id}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 text-right space-y-1 shadow-xs"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-800 truncate max-w-[130px]">
                            {b?.title || 'كتاب مقروء'}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold border ${m.cls}`}>
                            {m.label}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {comp.requestDate ? new Date(comp.requestDate).toLocaleDateString('ar-SA') : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modal: Transfer Conversation to Administration */}
      {transferModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setTransferModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#3b707d] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Forward className="w-5 h-5" />
                <h4 className="font-black text-sm">تحويل المحادثة إلى الإدارة</h4>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                سيتم نقل هذه المحادثة إلى صندوق وارد الإدارة مع الاحتفاظ بكامل سجل الرسائل وإشعار الإدارة بذلك.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  سبب التحويل (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="مثال: يتطلب قراراً إدارياً بخصوص تمديد أو عهدة كتاب..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTransferToAdmin}
                  className="px-4 py-2 rounded-xl bg-[#3b707d] hover:bg-[#2c5661] text-white text-xs font-bold"
                >
                  تأكيد التحويل للإدارة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImageLightboxModal image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </div>
  );
};
