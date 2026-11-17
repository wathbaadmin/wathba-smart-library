import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Book } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { StudentTab } from './StudentSidebar';
import { formatArabicDate, formatArabicDateTime, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { generateQRCodeDataUrl } from '../../lib/qrGenerator';
import { normalizeDiscussionStatus } from '../../lib/discussionUtils';
import { BookDetailsModal } from './BookDetailsModal';
import {
  Clock,
  BookOpen,
  History,
  MessageSquareText,
  Trophy,
  Award,
  Crown,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
  LogOut,
  XCircle,
  Lock,
  GraduationCap,
  Layers,
  Eye,
  FileText,
  Sparkles,
} from 'lucide-react';

interface ExtraViewProps {
  onNavigateTab: (tab: StudentTab) => void;
  onQuickRequestDiscussion?: (loanId: string, book?: Book) => void;
}

export const StudentReservationsView: React.FC<ExtraViewProps> = ({ onNavigateTab }) => {
  const { currentStudent } = useAuth();
  const { reservations, books, copies, updateReservationStatus } = useLibrary();
  const { showToast } = useNotifications();

  const myReservations = useMemo(
    () =>
      !currentStudent
        ? []
        : reservations
            .filter((r) => r.studentId === currentStudent.id)
            .sort(
              (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
            ),
    [currentStudent, reservations]
  );

  if (!currentStudent) return null;

  const handleCancel = (resId: string, title?: string) => {
    if (!window.confirm(`هل تريد إلغاء طلب حجز كتاب "${title || ''}"؟`)) return;
    updateReservationStatus(resId, 'cancelled', currentStudent.id);
    showToast('تم إلغاء طلب الحجز بنجاح', 'info');
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#dde6ed] p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#1c353d]">حجوزاتي وطلبات الكتب</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة حالة الكتب المحجوزة وتجهيز النسخ على رف الاستلام في المكتبة
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => onNavigateTab('catalog')}>
          استكشاف كتب جديدة
        </Button>
      </div>

      {myReservations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#dde6ed] p-12 text-center space-y-3 shadow-sm">
          <Clock className="w-10 h-10 text-[#3b707d] mx-auto opacity-80" />
          <h3 className="text-sm font-black text-[#1c353d]">لا توجد لديك طلبات حجز مسجلة</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك تصفح فهرس المكتبة وحجز أي كتاب متاح ليتم تجهيزه لك عند المشرف.
          </p>
          <Button variant="secondary" size="sm" onClick={() => onNavigateTab('catalog')}>
            الانتقال إلى فهرس الكتب
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myReservations.map((res) => {
            const book = books.find((b) => b.id === res.bookId);
            const assignedCopy = res.assignedCopyId
              ? copies.find((c) => c.id === res.assignedCopyId)
              : undefined;
            const canCancel =
              res.status === 'new_request' ||
              res.status === 'pending_approval' ||
              res.status === 'ready_for_pickup';

            return (
              <div
                key={res.id}
                className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-14 rounded-xl bg-[#3b707d] text-white flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="text-sm font-black text-[#1c353d] truncate">
                      {book?.title || 'كتاب محجوز'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {book?.author} • <span className="font-mono">{book?.code}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge status={res.status} size="sm" />
                      {assignedCopy && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#e3ecf3] text-[#1c353d]">
                          نسخة: {assignedCopy.copyCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>تاريخ الطلب: {formatArabicDateTime(res.requestedAt)}</span>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancel(res.id, book?.title)}
                      className="text-rose-700 hover:underline font-black flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      إلغاء الحجز
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const StudentReadingHistoryView: React.FC<ExtraViewProps> = ({
  onNavigateTab,
  onQuickRequestDiscussion,
}) => {
  const { currentStudent } = useAuth();
  const { loans, copies, books, readingLogs, discussions, readingCompletions } = useLibrary();
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<Book | null>(null);

  // سجل إكمال القراءة الخاص بالطالب
  const studentCompletions = useMemo(() => {
    if (!currentStudent) return [];
    return (readingCompletions || [])
      .filter((c) => c.studentId === currentStudent.id)
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [currentStudent, readingCompletions]);

  const approvedCompletionsCount = studentCompletions.filter((c) => c.status === 'approved').length;
  const pendingCompletionsCount = studentCompletions.filter((c) => c.status === 'pending_approval').length;

  const myLogs = useMemo(
    () =>
      !currentStudent
        ? []
        : (readingLogs || [])
            .filter((r) => r.studentId === currentStudent.id && r.status === 'approved')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [currentStudent, readingLogs]
  );

  const totalApprovedPages = useMemo(() => {
    return myLogs.reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
  }, [myLogs]);

  if (!currentStudent) return null;

  return (
    <div className="space-y-6">
      {/* رأس الصفحة مع الإحصائيات السريعة */}
      <div className="bg-white rounded-2xl border border-[#dde6ed] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#1c353d] flex items-center gap-2">
              <History className="w-5 h-5 text-[#3b707d]" />
              <span>سجل قراءاتي</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              سجل شامل وموثق لجميع الكتب والصفحات التي أتممت قراءتها ونتائج المناقشات المعتمدة
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onNavigateTab('my_books')}>
            كتبي المستعارة حالياً
          </Button>
        </div>

        {/* كروت ملخص القراءة والصفحات */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-center">
            <span className="block font-black text-xl text-emerald-800">
              {approvedCompletionsCount}
            </span>
            <span className="text-[11px] font-bold text-emerald-700">كتب معتمدة ومكتملة</span>
          </div>

          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 text-center">
            <span className="block font-black text-xl text-sky-800">
              {totalApprovedPages.toLocaleString('ar-SA')}
            </span>
            <span className="text-[11px] font-bold text-sky-700">صفحة معتمدة بالسجل</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-center">
            <span className="block font-black text-xl text-amber-800">
              {pendingCompletionsCount}
            </span>
            <span className="text-[11px] font-bold text-amber-700">بانتظار اعتماد المشرف</span>
          </div>

          <div className="p-3 rounded-xl bg-[#e3ecf3]/70 border border-[#3b707d]/20 text-center">
            <span className="block font-black text-xl text-[#1c353d]">
              {currentStudent.totalBooksRead || approvedCompletionsCount}
            </span>
            <span className="text-[11px] font-bold text-[#3b707d]">إجمالي رصيد قراءاتي</span>
          </div>
        </div>
      </div>

      {/* قائمة الكتب في سجل قراءاتي */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-[#1c353d] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#3b707d]" />
            <span>قائمة الكتب المكتملة وقيد المراجعة ({studentCompletions.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">بدون صور غلاف وفق الإعدادات</span>
        </div>

        {studentCompletions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#dde6ed] p-10 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="font-black text-sm text-[#1c353d]">لا توجد كتب مسجلة في سجل قراءاتك بعد</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              عندما تستعير كتاباً وتفرغ من قراءته، اضغط على زر <strong>«إكمال الكتاب»</strong> في صفحة
              كتبي المستعارة ليقوم المشرف باعتماده وتوثيقه هنا في سجلك الذهبي.
            </p>
            <Button variant="primary" size="sm" onClick={() => onNavigateTab('my_books')}>
              الانتقال إلى كتبي المستعارة
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {studentCompletions.map((comp) => {
              const book = books.find((b) => b.id === comp.bookId);
              const loan = loans.find((l) => l.id === comp.loanId);

              const statusMeta: Record<
                string,
                { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
              > = {
                approved: {
                  label: 'قراءة مكتملة ومعتمدة',
                  bg: 'bg-emerald-50',
                  text: 'text-emerald-800',
                  border: 'border-emerald-200',
                  icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />,
                },
                new: {
                  label: 'طلب جديد بانتظار المشرف',
                  bg: 'bg-sky-50',
                  text: 'text-sky-800',
                  border: 'border-sky-200',
                  icon: <Clock className="w-3.5 h-3.5 text-sky-600 animate-pulse" />,
                },
                pending_approval: {
                  label: 'بانتظار اعتماد المشرف',
                  bg: 'bg-amber-50',
                  text: 'text-amber-800',
                  border: 'border-amber-200',
                  icon: <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />,
                },
                under_review: {
                  label: 'قيد المراجعة والتدقيق',
                  bg: 'bg-blue-50',
                  text: 'text-blue-800',
                  border: 'border-blue-200',
                  icon: <Clock className="w-3.5 h-3.5 text-blue-600" />,
                },
                needs_revision: {
                  label: 'يحتاج إلى استكمال',
                  bg: 'bg-amber-50',
                  text: 'text-amber-800',
                  border: 'border-amber-300',
                  icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600" />,
                },
                rejected: {
                  label: 'أُعيد للملاحظة / مرفوض',
                  bg: 'bg-rose-50',
                  text: 'text-rose-800',
                  border: 'border-rose-200',
                  icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
                },
              };

              const sm = statusMeta[comp.status] || statusMeta.pending_approval;

              return (
                <div
                  key={comp.id}
                  className="bg-white rounded-2xl border border-[#dde6ed] p-4 sm:p-5 shadow-xs hover:border-[#3b707d]/40 transition-all space-y-3"
                >
                  {/* صف العنوان والمؤلف بدون صورة غلاف وفق متطلبات النظام */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {book?.code || 'كتاب'}
                        </span>
                        <h4 className="font-black text-sm sm:text-base text-[#1c353d]">
                          {book?.title || 'كتاب غير محدد'}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        المؤلف: <span className="font-bold text-slate-700">{book?.author || 'غير محدد'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 shrink-0 ${sm.bg} ${sm.text} ${sm.border}`}
                      >
                        {sm.icon}
                        <span>{sm.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* شبكة البيانات التسعة الموثقة */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-400 block font-medium">تاريخ الاستعارة</span>
                      <span className="font-bold text-slate-800 font-mono text-[11px] block">
                        {loan?.loanDate ? formatArabicDate(loan.loanDate) : '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-400 block font-medium">تاريخ إكمال الطالب</span>
                      <span className="font-bold text-slate-800 font-mono text-[11px] block">
                        {comp.requestDate ? formatArabicDate(comp.requestDate) : '—'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-400 block font-medium">تاريخ اعتماد الإكمال</span>
                      <span className="font-bold text-[#2c5661] font-mono text-[11px] block">
                        {comp.approvedAt ? formatArabicDate(comp.approvedAt) : 'قيد الاعتماد'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-400 block font-medium">المشرف المعتمد</span>
                      <span className="font-bold text-slate-800 text-[11px] block truncate">
                        {comp.approvedByStaffName || 'بانتظار المشرف'}
                      </span>
                    </div>
                  </div>

                  {/* حالة المناقشة القرائية والصفحات المعتمدة بالسجل */}
                  {(() => {
                    const disc = discussions.find(
                      (d) => d.studentId === currentStudent.id && d.bookId === comp.bookId && d.status !== 'cancelled'
                    );
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#f8fafc] border border-slate-200/80 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{book?.pageCount ? `${book.pageCount} صفحة مسجلة بالسجل` : '100 صفحة مسجلة'}</span>
                          </span>

                          {disc ? (
                            <span className="flex items-center gap-1.5 text-slate-700 font-bold text-[11px]">
                              <MessageSquareText className="w-3.5 h-3.5 text-[#3b707d]" />
                              <span>
                                {disc.status === 'approved' ? (
                                  <strong className="text-emerald-700">مناقشة معتمدة (+{disc.pointsAwarded || 0} نقطة)</strong>
                                ) : disc.status === 'scheduled' ? (
                                  <strong className="text-blue-700">موعد مناقشة: {formatArabicDate(disc.scheduledDate || '')}</strong>
                                ) : (
                                  <span className="text-amber-700">طلب مناقشة قيد المتابعة</span>
                                )}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">لم تُطلب مناقشة بعد</span>
                          )}
                        </div>

                        {comp.studentNotes && (
                          <span className="text-slate-500 italic text-[11px] truncate max-w-xs">
                            «{comp.studentNotes}»
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* سطر الصفحات وملاحظات الطالب أو المشرف */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                      {comp.status === 'rejected' && comp.rejectionReason && (
                        <span className="text-rose-700 font-bold">
                          ملاحظة المشرف: {comp.rejectionReason}
                        </span>
                      )}
                    </div>

                    {book && (
                      <button
                        type="button"
                        onClick={() => setSelectedBookForDetails(book)}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#e3ecf3] text-[#2c5661] font-bold text-xs transition-colors flex items-center gap-1.5 w-fit"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>فتح تفاصيل الكتاب</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* سجل الصفحات المعتمدة للمتابعة الميدانية */}
      {myLogs.length > 0 && (
        <section className="bg-white rounded-2xl border border-[#dde6ed] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-[#1c353d]">
              سجل الصفحات القرائية المعتمدة ({myLogs.length})
            </h3>
            <span className="text-[11px] text-slate-500">توثيق القراءة المرحلية</span>
          </div>

          <div className="divide-y divide-slate-100">
            {myLogs.map((log) => {
              const bk = books.find((b) => b.id === log.bookId);
              return (
                <div
                  key={log.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50/50"
                >
                  <div>
                    <span className="font-black text-[#1c353d] block">{bk?.title || 'كتاب قرائي'}</span>
                    <span className="text-[11px] text-slate-500">
                      {formatUmmAlQuraDate(log.readingDate || log.createdAt)}
                      {log.studentNotes ? ` • ${log.studentNotes}` : ''}
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#e3ecf3] text-[#1c353d] font-black font-mono shrink-0 w-fit">
                    +{log.correctedPagesCount ?? log.pagesCount} صفحة
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modal تفاصيل الكتاب المكتمل */}
      {selectedBookForDetails && (
        <BookDetailsModal
          book={selectedBookForDetails}
          isOpen={Boolean(selectedBookForDetails)}
          onClose={() => setSelectedBookForDetails(null)}
        />
      )}
    </div>
  );
};

export const StudentAchievementsView: React.FC<ExtraViewProps> = ({ onNavigateTab }) => {
  const { currentStudent } = useAuth();
  const {
    readingRanks,
    discussions,
    getStudentRankSummary,
    getStudentDiscussionPoints,
  } = useLibrary();

  if (!currentStudent) return null;

  const rankSummary = getStudentRankSummary(currentStudent.id);
  const discussionPoints = getStudentDiscussionPoints(currentStudent.id);
  const approvedDiscussionsCount = (discussions || []).filter(
    (d) =>
      d.studentId === currentStudent.id &&
      normalizeDiscussionStatus(d.status) === 'approved'
  ).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#dde6ed] p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#3b707d]" />
            <h2 className="text-lg font-black text-[#1c353d]">إنجازاتي القرائية ونقاطي</h2>
          </div>
          <p className="text-xs text-slate-500">
            ملخص الألقاب المحققة، صفحات القراءة المعتمدة، ونقاط المناقشات القرائية
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Award className="w-4 h-4" />}
          onClick={() => onNavigateTab('ranks_certificates')}
        >
          عرض الألقاب والشهادات القابلة للطباعة
        </Button>
      </div>

      {/* Achievement Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-500 block">الرتبة الحالية</span>
          <span className="text-lg font-black text-[#1c353d] mt-1 block">
            {rankSummary.currentRank?.title || 'بداية المسار'}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-500 block">الصفحات المعتمدة</span>
          <span className="text-2xl font-black text-[#3b707d] mt-1 block">
            {rankSummary.totalApprovedPages.toLocaleString('ar-SA')}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-500 block">نقاط المناقشات</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {discussionPoints}
          </span>
          <span className="text-[11px] text-slate-500">{approvedDiscussionsCount} مناقشة معتمدة</span>
        </div>
        <div className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm">
          <span className="text-xs font-bold text-slate-500 block">الكتب المقروءة</span>
          <span className="text-2xl font-black text-[#1c353d] mt-1 block">
            {currentStudent.totalBooksRead}
          </span>
        </div>
      </div>

      {/* Reading Ladder */}
      <div className="bg-white rounded-2xl border border-[#dde6ed] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-[#1c353d]">سلّم الألقاب القرائية في المكتبة</h3>
          <span className="text-xs font-bold text-[#3b707d]">
            {rankSummary.certificates.length} شهادة مكتسبة
          </span>
        </div>

        <div className="space-y-3">
          {readingRanks.map((rank) => {
            const achieved = rankSummary.totalApprovedPages >= rank.requiredPages;
            const progress =
              rank.requiredPages > 0
                ? Math.min(100, Math.round((rankSummary.totalApprovedPages / rank.requiredPages) * 100))
                : 100;
            return (
              <div
                key={rank.id}
                className={`p-4 rounded-xl border transition-colors ${
                  achieved
                    ? 'bg-[#e3ecf3]/55 border-[#3b707d]/35'
                    : 'bg-[#f4f7f9]/70 border-[#dde6ed]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {achieved ? (
                      <Crown className="w-4 h-4 text-[#3b707d]" />
                    ) : (
                      <Award className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-sm font-black text-[#1c353d]">{rank.title}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-600">
                    {rank.requiredPages.toLocaleString('ar-SA')} صفحة
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white border border-[#dde6ed] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${achieved ? 'bg-emerald-600' : 'bg-[#3b707d]'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const StudentProfileView: React.FC = () => {
  const { currentStudent, logout } = useAuth();
  const { showToast } = useNotifications();
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    if (currentStudent?.qrToken) {
      generateQRCodeDataUrl(currentStudent.qrToken).then((url) => {
        if (active) setQrUrl(url);
      });
    }
    return () => {
      active = false;
    };
  }, [currentStudent?.qrToken]);

  if (!currentStudent) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentStudent.internalId);
      setCopied(true);
      showToast('تم نسخ كود الطالب بنجاح', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('تعذر النسخ التلقائي للحافظة', 'warning');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-[#dde6ed] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#3b707d] text-white flex items-center justify-center text-xl font-black shrink-0">
            {currentStudent.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-black text-[#1c353d]">{currentStudent.fullName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentStudent.grade} • {currentStudent.stage}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#e3ecf3] text-[#1c353d] text-[11px] font-black">
                المجموعة: {currentStudent.groupName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                حساب نشط
              </span>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="danger"
          size="md"
          icon={<LogOut className="w-4 h-4" />}
          onClick={() => logout()}
        >
          تسجيل الخروج
        </Button>
      </div>

      {/* Protected Read-only Credentials & Membership Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        <div className="md:col-span-7 bg-white rounded-2xl border border-[#dde6ed] p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-[#3b707d]" />
            <h3 className="text-sm font-black text-[#1c353d]">بيانات العضوية والدخول</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#f4f7f9] border border-[#dde6ed] flex items-center justify-between gap-2">
              <div>
                <span className="text-slate-500 block text-[11px]">كود الطالب التعريفي (للدخول)</span>
                <span className="font-mono font-black text-base text-[#1c353d]" dir="ltr">
                  {currentStudent.internalId}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={handleCopyCode}
              >
                {copied ? 'تم النسخ' : 'نسخ الكود'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]">
                <span className="text-slate-500 block text-[11px] flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-[#3b707d]" /> الصف والمرحلة
                </span>
                <span className="font-black text-[#1c353d] mt-1 block">
                  {currentStudent.grade} - {currentStudent.stage}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]">
                <span className="text-slate-500 block text-[11px] flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#3b707d]" /> المجموعة
                </span>
                <span className="font-black text-[#1c353d] mt-1 block">
                  {currentStudent.groupName}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#e3ecf3]/55 border border-[#c5d8df] flex items-start gap-2.5 text-[11px] text-[#27434b]">
              <Lock className="w-4 h-4 text-[#3b707d] shrink-0 mt-0.5" />
              <span>
                بيانات هويتك محمية للقراءة فقط. في حال رغبتك بتغيير رمز الدخول، يرجى التواصل مع مشرف المجموعة أو إدارة المكتبة، وتنتهي الجلسة تلقائياً عند الخمول لمدة 30 دقيقة.
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-5 bg-white rounded-2xl border border-[#dde6ed] p-5 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
          <span className="text-xs font-black text-[#1c353d]">بطاقة الاستعارة السريعة (QR)</span>
          {qrUrl ? (
            <img
              src={qrUrl}
              alt={`بطاقة ${currentStudent.fullName}`}
              className="w-36 h-36 rounded-xl border border-[#dde6ed] p-1.5 bg-white"
            />
          ) : (
            <div className="w-36 h-36 rounded-xl bg-[#f4f7f9] border border-[#dde6ed] flex items-center justify-center text-xs text-slate-400">
              جاري التحميل...
            </div>
          )}
          <span className="text-[11px] text-slate-500">
            أبرز هذا الرمز للمشرف عند استعارة الكتب داخل المكتبة
          </span>
        </div>
      </div>
    </div>
  );
};
