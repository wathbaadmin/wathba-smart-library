import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { AdminTab } from './AdminSidebar';
import { SupervisorLogReadingModal } from './SupervisorLogReadingModal';
import { filterStudentsForStaffScope, normalizeDiscussionStatus } from '../../lib/discussionUtils';
import { formatArabicDate, formatUmmAlQuraDate, isOverdue } from '../../lib/dateUtils';
import { Button } from '../common/Button';
import {
  Users,
  BookOpen,
  ArrowRightLeft,
  AlertTriangle,
  Clock,
  MessageSquareText,
  MessageSquare,
  ScanLine,
  BookMarked,
  Award,
  BarChart3,
  ChevronLeft,
  CheckCircle2,
  RotateCcw,
  FileText,
  History,
  UserPlus,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigateTab: (tab: AdminTab) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { currentStaff } = useAuth();
  const {
    staff,
    students,
    books,
    copies,
    categories,
    loans,
    reservations,
    returnRequests,
    exchangeRequests,
    discussions,
    conversations,
    readingLogs,
    auditLogs,
    readingCompletions,
  } = useLibrary();
  const { setPendingChatConversationId } = useNotifications();

  const [logReadingModalOpen, setLogReadingModalOpen] = useState(false);

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';

  // Scoped datasets
  const scopedStudents = useMemo(
    () => filterStudentsForStaffScope(students, liveStaff),
    [students, liveStaff]
  );
  const scopedStudentIds = useMemo(
    () => new Set(scopedStudents.map((s) => s.id)),
    [scopedStudents]
  );

  const scopedLoans = useMemo(
    () => (isAdmin ? loans : loans.filter((l) => scopedStudentIds.has(l.studentId))),
    [isAdmin, loans, scopedStudentIds]
  );
  const activeLoans = useMemo(
    () => scopedLoans.filter((l) => l.status === 'active'),
    [scopedLoans]
  );
  const overdueLoans = useMemo(
    () => activeLoans.filter((l) => isOverdue(l.dueDate)),
    [activeLoans]
  );

  const pendingReservations = useMemo(
    () =>
      (reservations || []).filter(
        (r) =>
          (r.status === 'new_request' || r.status === 'pending_approval') &&
          (isAdmin || scopedStudentIds.has(r.studentId))
      ),
    [isAdmin, reservations, scopedStudentIds]
  );

  const pendingReturnExchangeCount = useMemo(() => {
    const ret = (returnRequests || []).filter(
      (r) =>
        ['new', 'in_review', 'approved', 'waiting_for_pickup'].includes(r.status) &&
        (isAdmin || scopedStudentIds.has(r.studentId))
    ).length;
    const exc = (exchangeRequests || []).filter(
      (e) =>
        ['new', 'in_review', 'approved', 'waiting_for_old_book'].includes(e.status) &&
        (isAdmin || scopedStudentIds.has(e.studentId))
    ).length;
    return ret + exc;
  }, [exchangeRequests, isAdmin, returnRequests, scopedStudentIds]);

  const pendingDiscussions = useMemo(
    () =>
      (discussions || []).filter((d) => {
        const st = normalizeDiscussionStatus(d.status);
        const needsAction = st === 'awaiting_schedule' || st === 'requested' || st === 'pending_approval' || st === 'needs_rediscussion';
        return needsAction && (isAdmin || scopedStudentIds.has(d.studentId));
      }),
    [discussions, isAdmin, scopedStudentIds]
  );

  const scopedConversations = useMemo(() => {
    if (!liveStaff) return [];
    return (conversations || [])
      .filter((c) => {
        if (c.isArchived || c.status === 'archived') return false;
        if (isAdmin) return c.recipientType === 'admin';
        return c.recipientType === 'supervisor' && c.supervisorId === liveStaff.id;
      })
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
  }, [conversations, isAdmin, liveStaff]);

  const unreadMessagesCount = useMemo(
    () => scopedConversations.reduce((sum, c) => sum + (c.unreadCountSupervisor || 0), 0),
    [scopedConversations]
  );

  // Inventory & Copy Distribution (SVG Donut data)
  const copyMetrics = useMemo(() => {
    const available = copies.filter((c) => c.status === 'available').length;
    const borrowed = copies.filter((c) => c.status === 'borrowed').length;
    const other = Math.max(0, copies.length - available - borrowed);
    const total = copies.length || 1;
    const availPct = Math.round((available / total) * 100);
    const borrowedPct = Math.round((borrowed / total) * 100);
    const otherPct = Math.max(0, 100 - availPct - borrowedPct);
    return { available, borrowed, other, total: copies.length, availPct, borrowedPct, otherPct };
  }, [copies]);

  // Top groups or categories breakdown
  const groupStats = useMemo(() => {
    const groupsMap = new Map<string, { name: string; students: number; booksRead: number; pages: number }>();
    scopedStudents.forEach((st) => {
      const grp = st.groupName || 'عام';
      const cur = groupsMap.get(grp) || { name: grp, students: 0, booksRead: 0, pages: 0 };
      cur.students += 1;
      cur.booksRead += st.totalBooksRead || 0;
      groupsMap.set(grp, cur);
    });
    (readingLogs || []).forEach((log) => {
      const st = scopedStudents.find((s) => s.id === log.studentId);
      if (!st) return;
      const grp = st.groupName || 'عام';
      const cur = groupsMap.get(grp);
      if (cur) cur.pages += log.correctedPagesCount ?? log.pagesCount ?? 0;
    });
    return Array.from(groupsMap.values()).sort((a, b) => b.booksRead - a.booksRead).slice(0, 5);
  }, [readingLogs, scopedStudents]);

  const maxGroupBooks = Math.max(1, ...groupStats.map((g) => g.booksRead));

  // Action Queue Items
  const priorityQueue = useMemo(() => {
    const items: {
      id: string;
      kindLabel: string;
      tone: 'rose' | 'amber' | 'brand';
      title: string;
      meta: string;
      targetTab: AdminTab;
    }[] = [];

    overdueLoans.slice(0, 3).forEach((l) => {
      const st = students.find((s) => s.id === l.studentId);
      const cp = copies.find((c) => c.id === l.copyId);
      const bk = books.find((b) => b.id === cp?.bookId);
      items.push({
        id: `ov-${l.id}`,
        kindLabel: 'متأخر',
        tone: 'rose',
        title: `${st?.fullName || 'طالب'} — ${bk?.title || 'كتاب'}`,
        meta: `تاريخ الاستحقاق: ${formatArabicDate(l.dueDate)}`,
        targetTab: 'loans_overdue',
      });
    });

    pendingDiscussions.slice(0, 3).forEach((d) => {
      const st = students.find((s) => s.id === d.studentId);
      const bk = books.find((b) => b.id === d.bookId);
      items.push({
        id: `disc-${d.id}`,
        kindLabel: d.status === 'completed' || d.status === 'pending_approval' ? 'اعتماد مناقشة' : 'طلب مناقشة',
        tone: 'brand',
        title: `${st?.fullName || 'طالب'} — ${bk?.title || 'كتاب'}`,
        meta: d.scheduledDate ? `الموعد: ${formatArabicDate(d.scheduledDate)}` : 'بانتظار جدولة الموعد',
        targetTab: 'discussions',
      });
    });

    pendingReservations.slice(0, 2).forEach((r) => {
      const st = students.find((s) => s.id === r.studentId);
      const bk = books.find((b) => b.id === r.bookId);
      items.push({
        id: `res-${r.id}`,
        kindLabel: 'حجز كتاب',
        tone: 'amber',
        title: `${st?.fullName || 'طالب'} — ${bk?.title || 'كتاب'}`,
        meta: `تاريخ الطلب: ${formatArabicDate(r.requestedAt)}`,
        targetTab: 'reservations',
      });
    });

    (readingCompletions || [])
      .filter(
        (c) =>
          (c.status === 'new' || c.status === 'pending_approval') &&
          (isAdmin || scopedStudentIds.has(c.studentId))
      )
      .slice(0, 2)
      .forEach((c) => {
        const st = students.find((s) => s.id === c.studentId);
        const bk = books.find((b) => b.id === c.bookId);
        items.push({
          id: `comp-${c.id}`,
          kindLabel: 'إكمال كتاب',
          tone: 'amber',
          title: `${st?.fullName || 'طالب'} — ${bk?.title || 'كتاب'}`,
          meta: `تاريخ التقديم: ${formatArabicDate(c.requestDate || c.createdAt)}`,
          targetTab: 'reading_completions',
        });
      });

    return items.slice(0, 6);
  }, [books, copies, overdueLoans, pendingDiscussions, pendingReservations, readingCompletions, students, isAdmin, scopedStudentIds]);

  const totalPendingActions =
    overdueLoans.length +
    pendingReservations.length +
    pendingReturnExchangeCount +
    pendingDiscussions.length +
    (readingCompletions || []).filter((c) => c.status === 'new' || c.status === 'pending_approval').length;

  const recentActivity = useMemo(() => {
    return (auditLogs || []).slice(0, 5);
  }, [auditLogs]);

  // SVG Donut geometry
  const r = 42;
  const c = 2 * Math.PI * r;
  const availDash = (copyMetrics.availPct / 100) * c;
  const borrowedDash = (copyMetrics.borrowedPct / 100) * c;

  return (
    <div className="space-y-6">
      {/* Executive Welcome Header Strip */}
      <section className="bg-white rounded-2xl border border-[#dde6ed] p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-[#1c353d]">
              مرحباً بك، {liveStaff?.fullName || 'طاقم المكتبة'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#e3ecf3] text-[#1c353d] border border-[#c5d8df]">
              {isAdmin
                ? 'الإدارة العامة للمكتبة'
                : liveStaff?.assignedGroups?.length
                ? `مشرف: ${liveStaff.assignedGroups.join('، ')}`
                : 'مشرف مكتبة عام'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {formatUmmAlQuraDate(new Date())} • ملخص الأداء التشغيلي والمهام ذات الأولوية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<ScanLine className="w-4 h-4" />}
            onClick={() => onNavigateTab('barcode_scanner')}
          >
            إعارة / فحص كتاب
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Award className="w-4 h-4" />}
            onClick={() => setLogReadingModalOpen(true)}
          >
            تسجيل صفحات قراءة
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<BarChart3 className="w-4 h-4" />}
              onClick={() => onNavigateTab('reports_analytics')}
            >
              التقارير والتحليلات
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<MessageSquareText className="w-4 h-4" />}
              onClick={() => onNavigateTab('discussions')}
            >
              إدارة المناقشات
            </Button>
          )}
        </div>
      </section>

      {/* Top 4 Scoped Institutional KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('students')}
          className="bg-white rounded-2xl border border-[#dde6ed] p-4 sm:p-5 text-right shadow-sm hover:border-[#3b707d]/50 transition-colors flex items-center justify-between gap-3"
        >
          <div>
            <span className="text-xs font-bold text-slate-500 block">
              {isAdmin ? 'إجمالي الطلاب المسجلين' : 'الطلاب ضمن نطاقك'}
            </span>
            <span className="text-2xl font-black text-[#1c353d] mt-1 block">
              {scopedStudents.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {scopedStudents.filter((s) => s.status === 'active').length} حساب نشط
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab(isAdmin ? 'books' : 'loans_active')}
          className="bg-white rounded-2xl border border-[#dde6ed] p-4 sm:p-5 text-right shadow-sm hover:border-[#3b707d]/50 transition-colors flex items-center justify-between gap-3"
        >
          <div>
            <span className="text-xs font-bold text-slate-500 block">
              {isAdmin ? 'الكتب والنسخ بالمكتبة' : 'الإعارات النشطة للطلاب'}
            </span>
            <span className="text-2xl font-black text-[#1c353d] mt-1 block">
              {isAdmin ? books.length : activeLoans.length}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {isAdmin
                ? `${copyMetrics.available} نسخة متاحة من ${copyMetrics.total}`
                : `${overdueLoans.length} متأخرة عن الموعد`}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center shrink-0">
            {isAdmin ? <BookOpen className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab(overdueLoans.length > 0 ? 'loans_overdue' : 'discussions')}
          className="bg-white rounded-2xl border border-[#dde6ed] p-4 sm:p-5 text-right shadow-sm hover:border-[#3b707d]/50 transition-colors flex items-center justify-between gap-3"
        >
          <div>
            <span className="text-xs font-bold text-slate-500 block">
              {isAdmin ? 'الإعارات النشطة / المتأخرة' : 'إجراءات تنتظر التنفيذ'}
            </span>
            <span className="text-2xl font-black text-[#1c353d] mt-1 block">
              {isAdmin ? activeLoans.length : totalPendingActions}
            </span>
            <span
              className={`text-[11px] font-bold mt-0.5 block ${
                overdueLoans.length > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {isAdmin
                ? overdueLoans.length > 0
                  ? `${overdueLoans.length} متأخرة تحتاج متابعة`
                  : 'جميع الإعارات منتظمة'
                : `${pendingDiscussions.length} مناقشة • ${pendingReservations.length} حجز`}
            </span>
          </div>
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              overdueLoans.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-[#e3ecf3] text-[#3b707d]'
            }`}
          >
            {overdueLoans.length > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('student_chats')}
          className="bg-white rounded-2xl border border-[#dde6ed] p-4 sm:p-5 text-right shadow-sm hover:border-[#3b707d]/50 transition-colors flex items-center justify-between gap-3"
        >
          <div>
            <span className="text-xs font-bold text-slate-500 block">
              {isAdmin ? 'رسائل وطلبات معلقة' : 'الرسائل غير المقروءة'}
            </span>
            <span className="text-2xl font-black text-[#3b707d] mt-1 block">
              {isAdmin ? unreadMessagesCount + pendingDiscussions.length : unreadMessagesCount}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {unreadMessagesCount} رسالة جديدة • {pendingReturnExchangeCount} طلب إرجاع/استبدال
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#3b707d] text-white flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
        </button>
      </section>

      {/* Main 12-Column Asymmetric Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Primary Analytical & Queue Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Clean SVG Analytics & Performance Panel */}
          <section className="bg-white rounded-2xl border border-[#dde6ed] p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="text-sm sm:text-base font-black text-[#1c353d]">
                  {isAdmin
                    ? 'مؤشر جاهزية النسخ وأداء المجموعات'
                    : 'تقدم المجموعات القرائية وجاهزية النسخ'}
                </h2>
                <p className="text-[11px] text-slate-500">
                  تحليل حي لحالة النسخ الورقية ومقارنة القراءة بين المجموعات
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab(isAdmin ? 'reports_analytics' : 'reports_group')}
                className="text-xs font-black text-[#3b707d] hover:underline flex items-center gap-1 self-start sm:self-center"
              >
                <span>التفاصيل الكاملة</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* SVG Donut Chart */}
              <div className="md:col-span-5 flex items-center gap-4 bg-[#f4f7f9] p-4 rounded-xl border border-[#dde6ed]/70">
                <svg viewBox="0 0 110 110" className="w-24 h-24 shrink-0 -rotate-90">
                  <circle
                    cx="55"
                    cy="55"
                    r={r}
                    fill="none"
                    stroke="#dde6ed"
                    strokeWidth="12"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={r}
                    fill="none"
                    stroke="#3b707d"
                    strokeWidth="12"
                    strokeDasharray={`${availDash} ${c}`}
                    strokeLinecap="round"
                  />
                  {borrowedDash > 0 && (
                    <circle
                      cx="55"
                      cy="55"
                      r={r}
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="12"
                      strokeDasharray={`${borrowedDash} ${c}`}
                      strokeDashoffset={-availDash}
                    />
                  )}
                </svg>
                <div className="space-y-1.5 text-xs flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3b707d]" />
                      متاحة
                    </span>
                    <span className="font-mono font-black text-[#1c353d]">{copyMetrics.availPct}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                      مستعارة
                    </span>
                    <span className="font-mono font-black text-amber-800">{copyMetrics.borrowedPct}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-bold text-slate-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                      أخرى
                    </span>
                    <span className="font-mono font-bold text-slate-600">{copyMetrics.otherPct}%</span>
                  </div>
                  <div className="pt-1 border-t border-[#dde6ed] text-[10px] text-slate-500">
                    إجمالي النسخ: {copyMetrics.total} • التصنيفات: {categories.length}
                  </div>
                </div>
              </div>

              {/* Group Reading Activity Bar Visualization */}
              <div className="md:col-span-7 space-y-3">
                {groupStats.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">لا توجد مجموعات مسجلة بعد</p>
                ) : (
                  groupStats.map((g) => {
                    const widthPct = Math.max(8, Math.round((g.booksRead / maxGroupBooks) * 100));
                    return (
                      <div key={g.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-[#1c353d] truncate">
                            {g.name}{' '}
                            <span className="font-normal text-slate-400">({g.students} طالب)</span>
                          </span>
                          <span className="font-mono font-bold text-[#3b707d] shrink-0">
                            {g.booksRead} كتاب • {g.pages} ص
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-[#e3ecf3] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#3b707d] transition-all duration-300"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Actionable Work Queue */}
          <section className="bg-white rounded-2xl border border-[#dde6ed] overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#3b707d]" />
                <div>
                  <h2 className="text-sm sm:text-base font-black text-[#1c353d]">
                    قائمة المهام والإجراءات الفورية
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    اضغط على أي بند للانتقال مباشرة إلى صفحة المعالجة
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#e3ecf3] text-[#1c353d] font-mono text-xs font-black">
                {priorityQueue.length}
              </span>
            </div>

            {priorityQueue.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold text-slate-700">لا توجد متأخرات أو طلبات معلقة في الوقت الحالي</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {priorityQueue.map((item) => {
                  const badgeTone =
                    item.tone === 'rose'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : item.tone === 'amber'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-[#e3ecf3] text-[#1c353d] border-[#c5d8df]';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigateTab(item.targetTab)}
                      className="w-full p-4 flex items-center justify-between gap-3 text-right hover:bg-[#f4f7f9] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-black shrink-0 ${badgeTone}`}
                        >
                          {item.kindLabel}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-black text-[#1c353d] truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{item.meta}</div>
                        </div>
                      </div>
                      <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Secondary Operational Rail (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Inbox Messages Preview */}
          <section className="bg-white rounded-2xl border border-[#dde6ed] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#3b707d]" />
                <h2 className="text-sm font-black text-[#1c353d]">أحدث المحادثات الواردة</h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('student_chats')}
                className="text-[11px] font-black text-[#3b707d] hover:underline"
              >
                فتح الصندوق
              </button>
            </div>

            {scopedConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                لا توجد محادثات نشطة حالياً
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {scopedConversations.slice(0, 4).map((conv) => {
                  const st = students.find((s) => s.id === conv.studentId);
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => {
                        setPendingChatConversationId(conv.id);
                        onNavigateTab('student_chats');
                      }}
                      className="w-full p-3.5 text-right hover:bg-[#f4f7f9] transition-colors flex items-start justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#1c353d] truncate">
                            {st?.fullName || 'طالب'}
                          </span>
                          {conv.unreadCountSupervisor > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-[#3b707d] text-white text-[10px] font-black">
                              {conv.unreadCountSupervisor}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {conv.lastMessageContent || 'محادثة جديدة'}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {formatArabicDate(conv.lastMessageAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Fast Workflow Shortcuts */}
          <section className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-black text-[#1c353d]">اختصارات العمل السريعة</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('students')}
                className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/75 border border-[#dde6ed] text-right transition-colors space-y-1"
              >
                <UserPlus className="w-4 h-4 text-[#3b707d]" />
                <span className="text-xs font-black text-[#1c353d] block">شؤون الطلاب</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('requests_returns')}
                className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/75 border border-[#dde6ed] text-right transition-colors space-y-1"
              >
                <RotateCcw className="w-4 h-4 text-[#3b707d]" />
                <span className="text-xs font-black text-[#1c353d] block">طلبات الإرجاع</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('ranks_management')}
                className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/75 border border-[#dde6ed] text-right transition-colors space-y-1"
              >
                <BookMarked className="w-4 h-4 text-[#3b707d]" />
                <span className="text-xs font-black text-[#1c353d] block">الألقاب والقراءة</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('reports_student')}
                className="p-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3]/75 border border-[#dde6ed] text-right transition-colors space-y-1"
              >
                <FileText className="w-4 h-4 text-[#3b707d]" />
                <span className="text-xs font-black text-[#1c353d] block">تقارير الطلاب</span>
              </button>
            </div>
          </section>

          {/* Recent Audit Activity */}
          <section className="bg-white rounded-2xl border border-[#dde6ed] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#3b707d]" />
                <h2 className="text-sm font-black text-[#1c353d]">آخر العمليات المسجلة</h2>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('audit_logs')}
                  className="text-[11px] font-black text-[#3b707d] hover:underline"
                >
                  السجل الكامل
                </button>
              )}
            </div>
            {recentActivity.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">لا توجد عمليات مسجلة بعد</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentActivity.map((log) => (
                  <div key={log.id} className="p-3 text-xs space-y-0.5">
                    <div className="font-bold text-[#1c353d] truncate">
                      {log.notes || log.reason || log.action}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>{log.action}</span>
                      <span>{formatArabicDate(log.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Quick Log Reading Pages Modal */}
      {logReadingModalOpen && (
        <SupervisorLogReadingModal
          isOpen={logReadingModalOpen}
          onClose={() => setLogReadingModalOpen(false)}
        />
      )}
    </div>
  );
};
