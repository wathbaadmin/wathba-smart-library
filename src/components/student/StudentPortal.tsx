import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Book } from '../../types';
import { StudentBookCard } from './StudentBookCard';
import { StudentLoanCard } from './StudentLoanCard';
import { BookDetailsModal } from './BookDetailsModal';
import { QRCodeView } from '../qr/QRCodeView';
import { ReadingChallengeCard } from './ReadingChallengeCard';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { NotificationBell } from '../common/NotificationBell';
import { SyncStatusIndicator } from '../common/SyncStatusIndicator';
import { CHAT_OPEN_CONV_EVENT_NAME } from '../../lib/chatService';
import {
  formatArabicDate,
  formatArabicDateTime,
  calculateDaysDifferenceInRiyadh,
} from '../../lib/dateUtils';
import {
  Home,
  BookOpen,
  BookMarked,
  User,
  Search,
  Clock,
  LogOut,
  CheckCircle2,
  GraduationCap,
  Trophy,
  ArrowLeftRight,
  MessageSquare,
  MessageSquareText,
  Award,
  Crown,
  ChevronDown,
  Menu,
  X,
  AlertTriangle,
  Activity,
  ChevronLeft,
  FileQuestion,
} from 'lucide-react';
import { StudentRequestsView } from './StudentRequestsView';
import { StudentChatView } from './StudentChatView';
import { StudentDiscussionsView } from './StudentDiscussionsView';
import { RanksAndCertificatesView } from './ranks/RanksAndCertificatesView';
import { StudentExamsView } from './exams/StudentExamsView';
import { RankEmblem } from './ranks/RankEmblem';
import { StudentSidebar, StudentTab, getStudentTabLabel } from './StudentSidebar';
import {
  StudentReservationsView,
  StudentReadingHistoryView,
  StudentAchievementsView,
  StudentProfileView,
} from './StudentExtraViews';
import { PublicAchievementsView } from '../achievements/PublicAchievementsView';
import { getDiscussionStatusMeta, normalizeDiscussionStatus } from '../../lib/discussionUtils';

export type StudentNavTab = StudentTab | 'account';

export const StudentPortal: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { currentStudent, logout } = useAuth();
  const {
    settings,
    books,
    copies,
    categories,
    reservations,
    loans,
    readingChallenges,
    requestReservation,
    isStudentEligibleForLoan,
    returnRequests,
    exchangeRequests,
    conversations,
    messages,
    discussions,
    discussionSettings,
    requestDiscussion,
    getStudentRankSummary,
    getStudentDiscussionPoints,
  } = useLibrary();
  const { showToast, addNotification, pendingChatConversationId, setPendingChatConversationId } =
    useNotifications();

  const [activeTab, setActiveTab] = useState<StudentNavTab>('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<Book | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);
  const catalogSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (pendingChatConversationId && currentStudent) {
      setActiveTab('chat');
    }
  }, [currentStudent, pendingChatConversationId]);

  useEffect(() => {
    const handleOpenConv = (e: Event) => {
      const detail = (e as CustomEvent<{ conversationId?: string; targetRole?: string }>)?.detail;
      if (detail?.conversationId && currentStudent) {
        setPendingChatConversationId(detail.conversationId);
        setActiveTab('chat');
      }
    };
    window.addEventListener(CHAT_OPEN_CONV_EVENT_NAME, handleOpenConv);
    return () => window.removeEventListener(CHAT_OPEN_CONV_EVENT_NAME, handleOpenConv);
  }, [currentStudent, setPendingChatConversationId]);

  const handleClearPendingChat = useCallback(() => {
    setPendingChatConversationId(null);
  }, [setPendingChatConversationId]);

  const studentRecentActivities = useMemo(() => {
    if (!currentStudent) return [];
    const items: { id: string; title: string; subtitle: string; date: string; status: string; tab: StudentNavTab }[] = [];

    loans
      .filter((l) => l.studentId === currentStudent.id)
      .forEach((l) => {
        const c = copies.find((cp) => cp.id === l.copyId);
        const b = books.find((bk) => bk.id === c?.bookId);
        items.push({
          id: `act-loan-${l.id}`,
          title: l.status === 'returned' ? `تمت إعادة كتاب: ${b?.title || ''}` : `استعارة كتاب: ${b?.title || ''}`,
          subtitle: `نسخة ${c?.copyCode || '-'}`,
          date: l.returnDate || l.loanDate,
          status: l.status === 'active' && calculateDaysDifferenceInRiyadh(l.dueDate) < 0 ? 'overdue' : l.status,
          tab: 'my_books',
        });
      });

    (discussions || [])
      .filter((d) => d.studentId === currentStudent.id)
      .forEach((d) => {
        const b = books.find((bk) => bk.id === d.bookId);
        items.push({
          id: `act-disc-${d.id}`,
          title: `مناقشة قرائية: ${b?.title || ''}`,
          subtitle: d.status === 'approved' ? `النقاط المعتمدة: ${d.pointsAwarded}` : 'متابعة حالة المناقشة',
          date: d.updatedAt || d.requestDate,
          status: d.status,
          tab: 'my_discussions',
        });
      });

    const studentConvIds = new Set(
      (conversations || []).filter((c) => c.studentId === currentStudent.id).map((c) => c.id)
    );
    (messages || [])
      .filter((m) => studentConvIds.has(m.conversationId) && m.senderType !== 'student' && m.senderType !== 'system' && !m.isDeleted)
      .forEach((m) => {
        items.push({
          id: `act-msg-${m.id}`,
          title: `رسالة واردة من ${m.senderName}`,
          subtitle: m.content,
          date: m.createdAt,
          status: m.isRead ? 'completed' : 'waiting_reply',
          tab: 'chat',
        });
      });

    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [books, conversations, copies, currentStudent, discussions, loans, messages]);

  if (!currentStudent) return null;

  const rankSummary = getStudentRankSummary(currentStudent.id);
  const discussionPoints = getStudentDiscussionPoints(currentStudent.id);

  const safeReturnRequests = returnRequests || [];
  const safeExchangeRequests = exchangeRequests || [];
  const safeConversations = conversations || [];

  const activeStudentRequestsCount =
    safeReturnRequests.filter(
      (r) =>
        r.studentId === currentStudent.id &&
        !['completed', 'cancelled', 'rejected'].includes(r.status)
    ).length +
    safeExchangeRequests.filter(
      (e) =>
        e.studentId === currentStudent.id &&
        !['completed', 'cancelled', 'rejected'].includes(e.status)
    ).length;

  const studentConversations = safeConversations.filter((c) => c.studentId === currentStudent.id);
  const unreadMessagesCount = studentConversations
    .filter((c) => !c.isArchived && c.status !== 'archived')
    .reduce((sum, c) => sum + (c.unreadCountStudent || 0), 0);

  const studentDiscussions = (discussions || []).filter((d) => d.studentId === currentStudent.id);
  const scheduledDiscussionsCount = studentDiscussions.filter(
    (d) => normalizeDiscussionStatus(d.status) === 'scheduled' || d.status === 'needs_rediscussion'
  ).length;

  const handleQuickRequestDiscussion = (loanId: string, book?: Book) => {
    if (!book) return;
    const res = requestDiscussion({
      loanId,
      bookId: book.id,
      studentId: currentStudent.id,
    });
    if (res.success) {
      if (discussionSettings.enableNotifications !== false) {
        addNotification({
          recipientType: 'staff',
          title: 'طلب مناقشة كتاب جديد',
          message: `طلب الطالب ${currentStudent.fullName} مناقشة كتاب "${book.title}".`,
          type: 'info',
          actionLink: 'discussions',
        });
      }
      showToast('تم إرسال طلب مناقشة الكتاب إلى المشرف بنجاح.', 'success');
      setActiveTab('my_discussions');
    } else {
      showToast(res.error || 'تعذر تقديم طلب المناقشة', 'error');
    }
  };

  const studentActiveLoans = loans
    .filter((l) => l.studentId === currentStudent.id && l.status === 'active')
    .sort((a, b) => calculateDaysDifferenceInRiyadh(a.dueDate) - calculateDaysDifferenceInRiyadh(b.dueDate));

  const dueSoonOrOverdueLoans = studentActiveLoans.filter(
    (l) => calculateDaysDifferenceInRiyadh(l.dueDate) <= 2
  );

  const studentReservations = reservations.filter(
    (r) => r.studentId === currentStudent.id && r.status !== 'fulfilled' && r.status !== 'cancelled'
  );
  const studentHistory = loans.filter(
    (l) => l.studentId === currentStudent.id && l.status === 'returned'
  );

  const currentChallenge = readingChallenges.find((c) => c.isActive) || readingChallenges[0];
  const availableBooks = books.filter((b) => b.availableCopiesCount > 0);
  const recommendedBooks = books.filter((b) => b.isFeatured || b.isBookOfTheWeek);

  const filteredCatalog = books.filter((b) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      b.title.toLowerCase().includes(term) ||
      b.author.toLowerCase().includes(term) ||
      b.code.toLowerCase().includes(term) ||
      b.description.toLowerCase().includes(term)
    );
  });

  const handleReserveBook = (bookId: string) => {
    const res = requestReservation(bookId, currentStudent.id);
    if (res.success) {
      showToast('تم إرسال طلب حجز الكتاب بنجاح.', 'success', 'طلب حجز');
    } else {
      showToast(res.error || 'تعذر حجز الكتاب', 'error');
    }
  };

  const eligibility = isStudentEligibleForLoan(currentStudent.id);

  const handleGoToSearch = () => {
    setActiveTab('catalog');
    setTimeout(() => {
      catalogSearchInputRef.current?.focus();
    }, 120);
  };

  const firstName = currentStudent.fullName.trim().split(' ')[0] || currentStudent.fullName;

  const studentShortcuts: {
    id: string;
    label: string;
    desc: string;
    icon: React.ReactNode;
    badge?: number;
    onClick: () => void;
  }[] = [
    {
      id: 'library',
      label: 'مكتبتي',
      desc: 'تصفح الفهرس',
      icon: <BookOpen className="w-5 h-5" />,
      onClick: () => setActiveTab('catalog'),
    },
    {
      id: 'search',
      label: 'البحث عن كتاب',
      desc: 'ابحث بالعنوان أو المؤلف',
      icon: <Search className="w-5 h-5" />,
      onClick: handleGoToSearch,
    },
    {
      id: 'my_books',
      label: 'كتبي المستعارة',
      desc: 'المواعيد والتسليم',
      icon: <BookMarked className="w-5 h-5" />,
      badge: studentActiveLoans.length || undefined,
      onClick: () => setActiveTab('my_books'),
    },
    {
      id: 'requests',
      label: 'طلباتي',
      desc: 'الإرجاع والاستبدال',
      icon: <ArrowLeftRight className="w-5 h-5" />,
      badge: activeStudentRequestsCount || undefined,
      onClick: () => setActiveTab('my_requests'),
    },
    {
      id: 'discussions',
      label: 'مناقشاتي',
      desc: 'طلب ومتابعة المناقشات',
      icon: <MessageSquareText className="w-5 h-5" />,
      badge: scheduledDiscussionsCount || undefined,
      onClick: () => setActiveTab('my_discussions'),
    },
    {
      id: 'ranks',
      label: 'ألقابي وشهاداتي',
      desc: 'الإنجازات والأوسمة',
      icon: <Award className="w-5 h-5" />,
      onClick: () => setActiveTab('ranks_certificates'),
    },
    {
      id: 'exams',
      label: 'اختباراتي',
      desc: 'نماذج وتقييمات القراءة',
      icon: <FileQuestion className="w-5 h-5" />,
      onClick: () => setActiveTab('my_exams'),
    },
    {
      id: 'chat',
      label: 'المحادثات',
      desc: 'مراسلة الإدارة والمشرفين',
      icon: <MessageSquare className="w-5 h-5" />,
      badge: unreadMessagesCount || undefined,
      onClick: () => setActiveTab('chat'),
    },
  ];

  const desktopNavItems: {
    id: StudentNavTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    { id: 'home', label: 'الرئيسية', icon: <Home className="w-4 h-4" /> },
    { id: 'catalog', label: 'المكتبة', icon: <BookOpen className="w-4 h-4" /> },
    {
      id: 'my_books',
      label: 'كتبي',
      icon: <BookMarked className="w-4 h-4" />,
      badge: studentActiveLoans.length || undefined,
    },
    {
      id: 'my_discussions',
      label: 'مناقشاتي',
      icon: <MessageSquareText className="w-4 h-4" />,
      badge: scheduledDiscussionsCount || undefined,
    },
    {
      id: 'my_requests',
      label: 'طلباتي',
      icon: <ArrowLeftRight className="w-4 h-4" />,
      badge: activeStudentRequestsCount || undefined,
    },
    {
      id: 'ranks_certificates',
      label: 'ألقابي',
      icon: <Award className="w-4 h-4" />,
    },
    {
      id: 'chat',
      label: 'المحادثات',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: unreadMessagesCount || undefined,
    },
  ];

  const pendingReservationsCount = studentReservations.filter(
    (r) => r.status === 'new_request' || r.status === 'pending_approval' || r.status === 'ready_for_pickup'
  ).length;

  return (
    <div dir="rtl" className="min-h-screen bg-[#f4f7f9] flex flex-col lg:flex-row font-arabic text-slate-800 overflow-x-clip">
      {/* Right Collapsible Student Sidebar + Mobile Drawer */}
      <StudentSidebar
        activeTab={(activeTab === 'account' ? 'my_profile' : activeTab) as StudentTab}
        setActiveTab={(t) => setActiveTab(t)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        activeLoansCount={studentActiveLoans.length}
        pendingReservationsCount={pendingReservationsCount}
        scheduledDiscussionsCount={scheduledDiscussionsCount}
        unreadMessagesCount={unreadMessagesCount}
        activeRequestsCount={activeStudentRequestsCount}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Institutional Bar */}
        <header className="h-16 sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-[#dde6ed] px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#dde6ed] bg-[#f4f7f9] text-[#1c353d] hover:bg-[#e3ecf3]"
              aria-label="فتح قائمة الطالب"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-sm sm:text-base text-[#1c353d] truncate">
                  {getStudentTabLabel(
                    (activeTab === 'account' ? 'my_profile' : activeTab) as StudentTab
                  )}
                </h1>
                <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-[#e3ecf3] text-[#27434b] border border-[#c5d8df]">
                  {currentStudent.groupName}
                </span>
              </div>
              <p className="text-[11px] font-bold text-[#3b707d] truncate">
                أهلاً بك، {firstName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* مؤشر المزامنة والتحديث الفوري للطالب */}
            <SyncStatusIndicator compact />

            <NotificationBell onOpenConversation={() => setActiveTab('chat')} />

            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                className="min-h-[40px] flex items-center gap-2 bg-[#f4f7f9] hover:bg-[#e3ecf3]/75 px-2.5 sm:px-3 py-1 rounded-xl border border-[#dde6ed] transition-colors"
                aria-expanded={accountMenuOpen}
                aria-label="قائمة حساب الطالب"
              >
                <div className="w-7 h-7 rounded-lg bg-[#3b707d] text-white flex items-center justify-center text-xs font-black shrink-0">
                  {currentStudent.fullName.trim().slice(0, 1)}
                </div>
                <div className="text-right hidden sm:block max-w-[130px]">
                  <div className="text-xs font-black text-[#1c353d] truncate leading-tight">
                    {currentStudent.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate leading-tight">
                    {currentStudent.grade}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {accountMenuOpen && (
                <div className="absolute left-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-[#dde6ed] overflow-hidden z-50">
                  <div className="p-3.5 bg-[#f4f7f9] border-b border-slate-100">
                    <div className="text-xs font-black text-[#1c353d] truncate">
                      {currentStudent.fullName}
                    </div>
                    <div className="text-[11px] text-[#3b707d] font-bold mt-0.5 font-mono" dir="ltr">
                      {currentStudent.internalId}
                    </div>
                  </div>
                  <div className="p-1.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('my_profile');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-[#e3ecf3]/70 flex items-center gap-2 text-right"
                    >
                      <User className="w-4 h-4 text-[#3b707d]" />
                      <span>بياناتي وبطاقة QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('ranks_certificates');
                        setAccountMenuOpen(false);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-[#e3ecf3]/70 flex items-center gap-2 text-right"
                    >
                      <Award className="w-4 h-4 text-[#3b707d]" />
                      <span>ألقابي وشهاداتي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 text-right"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Scrollable Container */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1440px] w-full mx-auto space-y-6">
        {/* ================= 1. TAB: الرئيسية (HOME) ================= */}
        {activeTab === 'home' && (
          <div className="space-y-6 sm:space-y-8">
            {/* منطقة الترحيب الرئيسية للطالب */}
            <section className="rounded-3xl bg-[#3b707d] text-white p-5 sm:p-7 shadow-soft border border-[#325d68] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2.5 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[#e3ecf3] text-xs font-bold">
                  <GraduationCap className="w-4 h-4" />
                  <span>
                    {rankSummary.currentRank
                      ? `الرتبة القرائية: ${rankSummary.currentRank.title}`
                      : `بوابة القارئ الذكي • ${settings.libraryName || 'مكتبة مداد'}`}
                  </span>
                </div>

                <h1 className="text-xl sm:text-3xl font-black text-white leading-snug">
                  مرحباً بك يا {currentStudent.fullName}
                </h1>

                <p className="text-xs sm:text-sm text-[#e3ecf3] leading-relaxed">
                  أتممت حتى الآن قراءة <strong>{currentStudent.totalBooksRead}</strong> كتاب، وبإجمالي{' '}
                  <strong>{rankSummary.totalApprovedPages.toLocaleString('ar-SA')}</strong> صفحة معتمدة و{' '}
                  <strong>{discussionPoints}</strong> نقطة مناقشة.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={<BookMarked className="w-4 h-4" />}
                  onClick={() => setActiveTab('my_books')}
                  className="flex-1 sm:flex-initial bg-white text-[#27434b] hover:bg-[#e3ecf3] border-0"
                >
                  كتبي الحالية ({studentActiveLoans.length})
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={<Search className="w-4 h-4" />}
                  onClick={handleGoToSearch}
                  className="flex-1 sm:flex-initial bg-white/15 text-white hover:bg-white/25 border border-white/25"
                >
                  البحث عن كتاب
                </Button>
              </div>
            </section>

            {/* تنبيهات مهمة (موعد إرجاع / مناقشة مجدولة / رسائل جديدة) */}
            {(dueSoonOrOverdueLoans.length > 0 || scheduledDiscussionsCount > 0 || unreadMessagesCount > 0) && (
              <section aria-label="تنبيهات مهمة" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dueSoonOrOverdueLoans.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('my_books')}
                    className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-right flex items-center justify-between gap-3 hover:bg-amber-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-amber-200/70 text-amber-900 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-amber-950">تنبيه موعد إرجاع</div>
                        <div className="text-[11px] text-amber-800 truncate">
                          لديك {dueSoonOrOverdueLoans.length} كتاب اقترب موعد إرجاعه أو حان
                        </div>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-amber-700 shrink-0" />
                  </button>
                )}

                {scheduledDiscussionsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('my_discussions')}
                    className="p-4 rounded-2xl bg-[#e3ecf3]/75 border border-[#c5d8df] text-right flex items-center justify-between gap-3 hover:bg-[#e3ecf3] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white text-[#3b707d] flex items-center justify-center shrink-0">
                        <MessageSquareText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-[#162b31]">موعد مناقشة قرائية</div>
                        <div className="text-[11px] text-[#27434b] truncate">
                          لديك {scheduledDiscussionsCount} مناقشة مجدولة أو تحتاج متابعة
                        </div>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-[#3b707d] shrink-0" />
                  </button>
                )}

                {unreadMessagesCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="p-4 rounded-2xl bg-white border border-[#3b707d]/30 text-right flex items-center justify-between gap-3 hover:bg-[#e3ecf3]/45 transition-colors shadow-soft"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#3b707d] text-white flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900">رسائل غير مقروءة</div>
                        <div className="text-[11px] text-slate-600 truncate">
                          لديك {unreadMessagesCount} رد جديد من الإدارة أو المشرف
                        </div>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-[#3b707d] shrink-0" />
                  </button>
                )}
              </section>
            )}

            {/* مساحة العمل الرئيسية المتوازنة (12 عموداً) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* العمود الأساسي (8 أعمدة): الكتب الحالية، مسار القراءة، المختارات */}
              <div className="lg:col-span-8 space-y-6">
                {/* 1. الكتب المستعارة حالياً ومواعيد الإرجاع */}
                <section className="bg-white rounded-2xl border border-[#dde6ed] p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <BookMarked className="w-5 h-5 text-[#3b707d]" />
                      <div>
                        <h3 className="font-black text-sm sm:text-base text-[#1c353d]">
                          كتبي المستعارة حالياً ({studentActiveLoans.length} / {settings.maxLoansPerStudent})
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          تابع مواعيد الإرجاع واطلب مناقشة الكتاب فور انتهائك منه
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('my_books')}>
                      إدارة كتبي
                    </Button>
                  </div>

                  {studentActiveLoans.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#f4f7f9] border border-[#dde6ed] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <p className="text-xs sm:text-sm font-black text-[#1c353d]">
                          ليس لديك كتب مستعارة في الوقت الحالي
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          استكشف فهرس المكتبة واحجز كتابك القادم بخطوة واحدة.
                        </p>
                      </div>
                      <Button variant="primary" size="sm" onClick={() => setActiveTab('catalog')}>
                        استكشاف الكتب
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {studentActiveLoans.map((loan) => {
                        const copy = copies.find((c) => c.id === loan.copyId);
                        const book = books.find((b) => b.id === copy?.bookId);
                        return (
                          <StudentLoanCard key={loan.id} loan={loan} book={book} copy={copy} />
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 2. مسار القراءة والرتب العلمية */}
                <section className="rounded-2xl bg-white border border-[#dde6ed] p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                  <div className="space-y-2.5 flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e3ecf3] text-[#1c353d] text-xs font-black">
                        {rankSummary.isWathabAchieved ? <Crown className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />}
                        <span>{rankSummary.currentRank ? `رتبتك: ${rankSummary.currentRank.title}` : 'بداية المسار القرائي'}</span>
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {rankSummary.totalApprovedPages.toLocaleString('ar-SA')} صفحة معتمدة • {discussionPoints} نقطة مناقشة
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm font-bold text-slate-800">
                      {rankSummary.nextRank ? (
                        <>
                          بقي لك{' '}
                          <strong className="text-[#3b707d]">
                            {rankSummary.remainingPagesToNext.toLocaleString('ar-SA')} صفحة
                          </strong>{' '}
                          للوصول إلى لقب {rankSummary.nextRank.title}
                        </>
                      ) : (
                        <span className="text-emerald-700">مبارك! بلغت أعلى رتبة في المكتبة «وثّاب»</span>
                      )}
                    </div>

                    <div className="w-full max-w-lg h-2.5 bg-[#e3ecf3] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#3b707d] rounded-full transition-all duration-300"
                        style={{ width: `${rankSummary.progressPercentToNext}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setActiveTab('my_achievements')}
                    >
                      إنجازاتي
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={<Award className="w-4 h-4" />}
                      onClick={() => setActiveTab('ranks_certificates')}
                    >
                      الشهادات ({rankSummary.certificates.length})
                    </Button>
                  </div>
                </section>

                {/* 3. مختارات مكتبة وثبة */}
                <section className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <h3 className="font-black text-sm sm:text-base text-[#1c353d]">
                        مختارات {settings.libraryName || 'مكتبة مداد الذكية'}
                      </h3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('catalog')}>
                      تصفح الفهرس الكامل
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(recommendedBooks.length > 0 ? recommendedBooks : availableBooks)
                      .slice(0, 4)
                      .map((book) => (
                        <StudentBookCard
                          key={book.id}
                          book={book}
                          category={categories.find((c) => c.id === book.categoryId)}
                          onViewDetails={setSelectedBookForDetails}
                          onReserve={handleReserveBook}
                          isReserved={reservations.some(
                            (r) =>
                              r.studentId === currentStudent.id &&
                              r.bookId === book.id &&
                              r.status !== 'fulfilled' &&
                              r.status !== 'cancelled'
                          )}
                          isEligible={eligibility.eligible}
                        />
                      ))}
                  </div>
                </section>
              </div>

              {/* العمود الجانبي المساعد (4 أعمدة): مؤشرات سريعة، التواصل، النشاط الأخير */}
              <div className="lg:col-span-4 space-y-6">
                {/* ملخص الإحصاءات السريع */}
                <section className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm space-y-3">
                  <h3 className="text-sm font-black text-[#1c353d]">مؤشراتك السريعة</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('reading_history')}
                      className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/70 border border-[#dde6ed] text-right transition-colors"
                    >
                      <span className="text-[11px] font-bold text-slate-500 block">كتب منجزة</span>
                      <span className="text-xl font-black text-[#1c353d]">{currentStudent.totalBooksRead}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('my_reservations')}
                      className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/70 border border-[#dde6ed] text-right transition-colors"
                    >
                      <span className="text-[11px] font-bold text-slate-500 block">حجوزاتي</span>
                      <span className="text-xl font-black text-[#3b707d]">{studentReservations.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('my_discussions')}
                      className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/70 border border-[#dde6ed] text-right transition-colors"
                    >
                      <span className="text-[11px] font-bold text-slate-500 block">نقاط المناقشات</span>
                      <span className="text-xl font-black text-emerald-700">{discussionPoints}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('my_requests')}
                      className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/70 border border-[#dde6ed] text-right transition-colors"
                    >
                      <span className="text-[11px] font-bold text-slate-500 block">طلبات نشطة</span>
                      <span className="text-xl font-black text-[#1c353d]">{activeStudentRequestsCount}</span>
                    </button>
                  </div>
                </section>

                {/* اختصارات الخدمات والتواصل */}
                <section className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-[#1c353d]">الوصول السريع</h3>
                  </div>
                  <div className="space-y-1.5">
                    {studentShortcuts.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={sc.onClick}
                        className="w-full p-2.5 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/80 border border-[#dde6ed]/70 flex items-center justify-between gap-2.5 text-right transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white border border-[#dde6ed] text-[#3b707d] flex items-center justify-center shrink-0">
                            {sc.icon}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-[#1c353d] block truncate">{sc.label}</span>
                            <span className="text-[10px] text-slate-500 block truncate">{sc.desc}</span>
                          </div>
                        </div>
                        {sc.badge !== undefined ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#3b707d] text-white text-[10px] font-black shrink-0">
                            {sc.badge}
                          </span>
                        ) : (
                          <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </section>

                {/* النشاط الأخير للطالب */}
                <section className="bg-white rounded-2xl border border-[#dde6ed] overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-black text-sm text-[#1c353d] flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#3b707d]" />
                      <span>آخر أنشطتي في المكتبة</span>
                    </h3>
                  </div>

                  {studentRecentActivities.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      لا توجد أنشطة حديثة مسجلة بعد — ابدأ باستعارة كتاب من المكتبة
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {studentRecentActivities.map((act) => (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => setActiveTab(act.tab)}
                          className="w-full text-right p-3.5 hover:bg-[#f4f7f9] flex items-start justify-between gap-2.5 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-black text-[#1c353d] truncate">
                              {act.title}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">{act.subtitle}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{formatArabicDateTime(act.date)}</div>
                          </div>
                          <Badge status={act.status} size="sm" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. TAB: المكتبة (CATALOG) ================= */}
        {activeTab === 'catalog' && (
          <div className="space-y-5">
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-soft space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    فهرس {settings.libraryName || 'مكتبة مداد الذكية'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تصفح {books.length} كتاب متاح واستعرض التفاصيل أو احجز نسختك مباشرة
                  </p>
                </div>

                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={catalogSearchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث بالعنوان، المؤلف، أو رمز الكتاب..."
                    className="w-full min-h-[44px] pr-10 pl-3 py-2 rounded-xl border border-slate-300 bg-[#f6f8fa] focus:bg-white text-sm sm:text-xs font-bold focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-500">
                لا توجد كتب مطابقة لكلمات البحث الحالية
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCatalog.map((book) => (
                  <StudentBookCard
                    key={book.id}
                    book={book}
                    category={categories.find((c) => c.id === book.categoryId)}
                    onViewDetails={setSelectedBookForDetails}
                    onReserve={handleReserveBook}
                    isReserved={reservations.some(
                      (r) =>
                        r.studentId === currentStudent.id &&
                        r.bookId === book.id &&
                        r.status !== 'fulfilled' &&
                        r.status !== 'cancelled'
                    )}
                    isEligible={eligibility.eligible}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'my_reservations' && (
          <StudentReservationsView onNavigateTab={setActiveTab} />
        )}

        {activeTab === 'reading_history' && (
          <StudentReadingHistoryView
            onNavigateTab={setActiveTab}
            onQuickRequestDiscussion={handleQuickRequestDiscussion}
          />
        )}

        {activeTab === 'my_achievements' && (
          <PublicAchievementsView onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}

        {(activeTab === 'my_profile' || activeTab === 'account') && <StudentProfileView />}

        {/* ================= 3. TAB: كتبي (MY BOOKS) ================= */}
        {activeTab === 'my_books' && (
          <div className="space-y-6 sm:space-y-8">
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-soft">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">كتبي وحجوزاتي</h2>
              <p className="text-xs text-slate-500 mt-1">
                متابعة الكتب المستعارة حالياً، الحجوزات الجارية، وسجل الكتب التي أتممت قراءتها
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#3b707d]" />
                <span>
                  الكتب المستعارة حالياً ({studentActiveLoans.length} من {settings.maxLoansPerStudent})
                </span>
              </h3>

              {studentActiveLoans.length === 0 ? (
                <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 shadow-soft space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center mx-auto">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-black text-slate-800">ليس لديك كتب مستعارة حالياً</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    تصفح مكتبة وثبة الذكية واختر كتابك المفضل لحجزه واستعارته.
                  </p>
                  <Button variant="primary" size="md" onClick={() => setActiveTab('catalog')}>
                    تصفح كتب المكتبة
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentActiveLoans.map((loan) => {
                    const copy = copies.find((c) => c.id === loan.copyId);
                    const book = books.find((b) => b.id === copy?.bookId);
                    return (
                      <StudentLoanCard key={loan.id} loan={loan} book={book} copy={copy} />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span>الكتب المحجوزة ({studentReservations.length})</span>
              </h3>

              {studentReservations.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
                  لا توجد طلبات حجز قيد الانتظار حالياً
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentReservations.map((res) => {
                    const book = books.find((b) => b.id === res.bookId);
                    return (
                      <div
                        key={res.id}
                        className="bg-white p-4 rounded-3xl border border-slate-200 shadow-soft flex items-center gap-3"
                      >
                        <div className="w-12 h-14 rounded-xl bg-[#3b707d] text-white flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {book?.title}
                          </h4>
                          <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                            {book?.code}
                          </span>
                          <div className="mt-1.5">
                            <Badge status={res.status} size="sm" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>سجل قراءاتي والكتب المعادة ({studentHistory.length})</span>
              </h3>

              {studentHistory.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
                  لم تكمل بعد قراءة أي كتاب في سجلك
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft divide-y divide-slate-100">
                  {studentHistory.map((h) => {
                    const copy = copies.find((c) => c.id === h.copyId);
                    const book = books.find((b) => b.id === copy?.bookId);
                    const bookDisc = book
                      ? studentDiscussions.find(
                          (d) => d.bookId === book.id && d.status !== 'cancelled'
                        )
                      : undefined;
                    const discMeta = bookDisc ? getDiscussionStatusMeta(bookDisc.status) : null;

                    return (
                      <div
                        key={h.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-[#f6f8fa] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-9 h-9 rounded-xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{book?.title}</div>
                            <span className="text-slate-500 text-[11px]">
                              تاريخ الإعادة: {formatArabicDate(h.returnDate)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <Badge status="returned" label="تمت القراءة" />
                          {bookDisc && discMeta ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('my_discussions')}
                              className={`min-h-[36px] px-3 py-1 rounded-full font-bold border text-[11px] ${discMeta.badgeClass}`}
                            >
                              {discMeta.label}
                            </button>
                          ) : (
                            discussionSettings.isEnabled && (
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                icon={<MessageSquareText className="w-3.5 h-3.5" />}
                                onClick={() => handleQuickRequestDiscussion(h.id, book)}
                              >
                                طلب مناقشة
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'my_discussions' && <StudentDiscussionsView />}
        {activeTab === 'my_requests' && <StudentRequestsView />}
        {activeTab === 'my_exams' && <StudentExamsView />}
        {activeTab === 'chat' && (
          <StudentChatView
            initialConversationId={pendingChatConversationId || undefined}
            onConversationOpened={handleClearPendingChat}
          />
        )}
        {activeTab === 'ranks_certificates' && <RanksAndCertificatesView />}
        </main>
      </div>

      {/* Mobile Bottom 5-Item Bar (<1024px) */}
      <nav
        aria-label="التنقل السفلي للجوال"
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-[#dde6ed] lg:hidden px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1"
      >
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black transition-colors ${
            activeTab === 'home' ? 'text-[#3b707d] bg-[#e3ecf3]/75' : 'text-slate-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black transition-colors ${
            activeTab === 'catalog' ? 'text-[#3b707d] bg-[#e3ecf3]/75' : 'text-slate-500'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span>المكتبة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my_books')}
          className={`relative min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black transition-colors ${
            activeTab === 'my_books' ? 'text-[#3b707d] bg-[#e3ecf3]/75' : 'text-slate-500'
          }`}
        >
          <BookMarked className="w-5 h-5" />
          <span>كتبي</span>
          {studentActiveLoans.length > 0 && (
            <span className="absolute top-1 left-2 min-w-[16px] h-4 px-1 rounded-full bg-[#3b707d] text-white text-[9px] font-black flex items-center justify-center">
              {studentActiveLoans.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`relative min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black transition-colors ${
            activeTab === 'chat' ? 'text-[#3b707d] bg-[#e3ecf3]/75' : 'text-slate-500'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>المحادثات</span>
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1 left-2 min-w-[16px] h-4 px-1 rounded-full bg-[#3b707d] text-white text-[9px] font-black flex items-center justify-center">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className={`relative min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black transition-colors ${
            [
              'my_reservations',
              'reading_history',
              'my_discussions',
              'my_requests',
              'my_exams',
              'ranks_certificates',
              'my_achievements',
              'my_profile',
              'account',
            ].includes(activeTab)
              ? 'text-[#3b707d] bg-[#e3ecf3]/75'
              : 'text-slate-500'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span>القائمة</span>
          {(scheduledDiscussionsCount > 0 || activeStudentRequestsCount > 0) && (
            <span className="absolute top-1.5 left-3 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>
      </nav>

      {/* Book Details Modal */}
      {selectedBookForDetails && (
        <BookDetailsModal
          isOpen={!!selectedBookForDetails}
          onClose={() => setSelectedBookForDetails(null)}
          book={selectedBookForDetails}
          category={categories.find((c) => c.id === selectedBookForDetails.categoryId)}
          student={currentStudent}
          onReserve={handleReserveBook}
          isReservedByStudent={reservations.some(
            (r) =>
              r.studentId === currentStudent.id &&
              r.bookId === selectedBookForDetails.id &&
              r.status !== 'fulfilled' &&
              r.status !== 'cancelled'
          )}
          isEligibleToReserve={eligibility.eligible}
          eligibilityReason={eligibility.reason}
        />
      )}
    </div>
  );
};
