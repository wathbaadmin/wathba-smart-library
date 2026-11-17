import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { formatArabicDate, formatUmmAlQuraDate, formatArabicDateTime } from '../../lib/dateUtils';
import { getDiscussionStatusMeta, normalizeDiscussionStatus } from '../../lib/discussionUtils';
import {
  MessageSquareText,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  Send,
  RotateCw,
  Award,
  ChevronDown,
  ChevronUp,
  Users,
  Sparkles,
  FileText,
} from 'lucide-react';
import { Loan, Book } from '../../types';

export const StudentDiscussionsView: React.FC = () => {
  const { currentStudent } = useAuth();
  const {
    discussions,
    books,
    copies,
    loans,
    staff,
    requestDiscussion,
    discussionSettings,
    getStudentDiscussionPoints,
    getBookReadingCoverage,
  } = useLibrary();
  const { showToast, addNotification } = useNotifications();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rediscussTarget, setRediscussTarget] = useState<{ loan: Loan; book: Book } | null>(null);
  const [rediscussReason, setRediscussReason] = useState('');

  if (!currentStudent) return null;

  const studentDiscussions = discussions
    .filter((d) => d.studentId === currentStudent.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalEarnedPoints = getStudentDiscussionPoints(currentStudent.id);
  const approvedDiscussions = studentDiscussions.filter((d) => d.status === 'approved');
  const avgScore =
    approvedDiscussions.length > 0
      ? Math.round(
          approvedDiscussions.reduce((sum, d) => sum + d.totalScore, 0) / approvedDiscussions.length
        )
      : 0;

  // استخراج أحدث إعارة لكل كتاب استعاره الطالب
  const latestLoanByBook = new Map<string, { loan: Loan; book: Book }>();
  loans
    .filter((l) => l.studentId === currentStudent.id && l.status !== 'cancelled')
    .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime())
    .forEach((loan) => {
      const copy = copies.find((c) => c.id === loan.copyId);
      const book = copy ? books.find((b) => b.id === copy.bookId) : undefined;
      if (book && !latestLoanByBook.has(book.id)) {
        latestLoanByBook.set(book.id, { loan, book });
      }
    });

  const studentBooksForDiscussion = Array.from(latestLoanByBook.values()).map(({ loan, book }) => {
    const bookDiscs = studentDiscussions.filter((d) => d.bookId === book.id);
    const activeDisc = bookDiscs.find((d) => {
      const s = normalizeDiscussionStatus(d.status);
      return (
        s === 'requested' ||
        s === 'awaiting_schedule' ||
        s === 'scheduled' ||
        s === 'discussed' ||
        s === 'pending_approval'
      );
    });
    const approvedDisc = bookDiscs.find((d) => d.status === 'approved');
    const needsRedoDisc = bookDiscs.find((d) => d.status === 'needs_rediscussion');
    const coverage = getBookReadingCoverage(currentStudent.id, book.id);

    return {
      loan,
      book,
      activeDisc,
      approvedDisc,
      needsRedoDisc,
      coverage,
    };
  });

  const handleRequestDiscussion = (loanId: string, book: Book, reason?: string) => {
    const result = requestDiscussion({
      loanId,
      bookId: book.id,
      studentId: currentStudent.id,
      rediscussionReason: reason,
    });

    if (result.success) {
      if (discussionSettings.enableNotifications !== false) {
        addNotification({
          recipientType: 'staff',
          title: 'طلب مناقشة كتاب جديد 💬',
          message: `طلب الطالب ${currentStudent.fullName} مناقشة كتاب "${book.title}".`,
          type: 'info',
          actionLink: 'discussions',
        });
      }
      showToast('تم إرسال طلب المناقشة للمشرف بنجاح! 📚', 'success', 'طلب مناقشة');
      setRediscussTarget(null);
      setRediscussReason('');
    } else {
      showToast(result.error || 'تعذر تقديم طلب المناقشة', 'error');
    }
  };

  const filteredDiscussions = studentDiscussions.filter((d) => {
    if (statusFilter === 'all') return true;
    return normalizeDiscussionStatus(d.status) === statusFilter;
  });

  const getBook = (bookId: string) => books.find((b) => b.id === bookId);
  const getSupervisorName = (supId?: string) =>
    (supId ? staff.find((s) => s.id === supId)?.fullName : undefined) || 'بانتظار التعيين';

  return (
    <div className="space-y-6">
      {/* 1. Hero & KPI Summary */}
      <div className="rounded-3xl bg-gradient-to-l from-[#27434b] via-[#3b707d] to-[#325d68] text-white p-6 sm:p-7 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-right">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <MessageSquareText className="w-6 h-6 text-gold-300" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white">مناقشاتي القرائية</h2>
              <p className="text-xs text-wathba-100 mt-0.5">
                ناقش الكتب التي قرأتها مع مشرفك لتثبت فهمك وتجمع النقاط المعتمدة بعد اعتماد النتيجة
              </p>
            </div>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-white/15 border border-white/20 text-center shrink-0">
            <span className="text-[10px] text-wathba-100 block font-bold">نقاط المناقشات المعتمدة</span>
            <strong className="text-xl font-black text-gold-300">{totalEarnedPoints} نقطة</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-wathba-100 block">إجمالي المناقشات</span>
            <strong className="text-xl font-black text-white">{studentDiscussions.length}</strong>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-wathba-100 block">مناقشات معتمدة</span>
            <strong className="text-xl font-black text-emerald-300">{approvedDiscussions.length}</strong>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-wathba-100 block">متوسط الدرجات</span>
            <strong className="text-xl font-black text-gold-300">{avgScore}%</strong>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
            <span className="text-[11px] text-wathba-100 block">النظام</span>
            <strong className="text-sm font-black text-white block mt-1">
              {discussionSettings.isEnabled ? 'مفعل ومتاح ✅' : 'متوقف مؤقتاً'}
            </strong>
          </div>
        </div>
      </div>

      {!discussionSettings.isEnabled && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 flex items-center gap-3 text-amber-800 text-xs font-bold">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>نظام تقديم طلبات المناقشة الجديدة متوقف مؤقتاً من قبل الإدارة. يمكنك استعراض سجل مناقشاتك السابقة أدناه.</span>
        </div>
      )}

      {/* 2. الكتب المرتبطة بإعارات الطالب وحالة طلب المناقشة لكل منها */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-wathba-600" />
              <span>الكتب التي استعرتها وطلب المناقشة</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              يمكنك طلب مناقشة أي كتاب استعرته من المكتبة بعد إتمام قراءته (لا تُمنح النقاط إلا بعد اعتماد المشرف).
            </p>
          </div>
        </div>

        {studentBooksForDiscussion.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
            لم تستعر أي كتاب بعد. استعر كتاباً من المكتبة وأتم قراءته لتظهر لك إمكانية طلب المناقشة هنا.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {studentBooksForDiscussion.map(({ loan, book, activeDisc, approvedDisc, needsRedoDisc, coverage }) => {
              const displayStatus = activeDisc
                ? getDiscussionStatusMeta(activeDisc.status)
                : needsRedoDisc
                ? getDiscussionStatusMeta('needs_rediscussion')
                : approvedDisc
                ? getDiscussionStatusMeta('approved')
                : getDiscussionStatusMeta('not_requested');

              return (
                <div
                  key={book.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-11 h-14 rounded-xl bg-gradient-to-tr from-wathba-800 to-wathba-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-900 truncate">{book.title}</h4>
                        <p className="text-[11px] text-slate-500 truncate">{book.author}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500">
                          <span>حالة الإعارة: {loan.status === 'returned' ? 'مُعاد' : 'معك حالياً'}</span>
                          <span>•</span>
                          <span>
                            المقروء المعتمد: {coverage.approvedPages}/{coverage.bookPageCount} صفحة
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${displayStatus.badgeClass}`}>
                      {displayStatus.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                    <span className="text-[11px] text-slate-500">
                      {loan.returnDate
                        ? `أُعيد في: ${formatUmmAlQuraDate(loan.returnDate)}`
                        : `تاريخ الاستعارة: ${formatUmmAlQuraDate(loan.loanDate)}`}
                    </span>

                    {discussionSettings.isEnabled && !activeDisc && !approvedDisc && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Send className="w-3.5 h-3.5" />}
                        onClick={() => handleRequestDiscussion(loan.id, book)}
                        className="text-xs font-bold"
                      >
                        {needsRedoDisc ? 'طلب إعادة مناقشة' : 'طلب مناقشة'}
                      </Button>
                    )}

                    {discussionSettings.isEnabled && !activeDisc && approvedDisc && discussionSettings.allowRediscussion && (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<RotateCw className="w-3.5 h-3.5" />}
                        onClick={() => setRediscussTarget({ loan, book })}
                        className="text-[11px] font-bold"
                      >
                        طلب إعادة مناقشة بمبرر
                      </Button>
                    )}

                    {activeDisc && (
                      <span className="text-[11px] font-bold text-wathba-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>قيد المتابعة</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. سجل المناقشات السابقة */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-wathba-600" />
            <span>سجل المناقشات ({filteredDiscussions.length})</span>
          </h3>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:outline-none"
          >
            <option value="all">جميع الحالات ({studentDiscussions.length})</option>
            <option value="awaiting_schedule">بانتظار تحديد الموعد</option>
            <option value="scheduled">تم تحديد الموعد</option>
            <option value="pending_approval">بانتظار اعتماد النتيجة</option>
            <option value="approved">معتمدة</option>
            <option value="needs_rediscussion">تحتاج إلى إعادة مناقشة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>

        {filteredDiscussions.length === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <MessageSquareText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold">لا توجد مناقشات مسجلة في هذا التصنيف حتى الآن</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDiscussions.map((disc) => {
              const statusInfo = getDiscussionStatusMeta(disc.status);
              const isExpanded = expandedId === disc.id;
              const book = getBook(disc.bookId);

              return (
                <div
                  key={disc.id}
                  className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:border-wathba-300 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : disc.id)}
                    className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-50/70 transition-colors text-right"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-wathba-100 text-wathba-700 flex items-center justify-center shrink-0">
                        {disc.type === 'group' ? <Users className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {book?.title || 'كتاب مكتبة وثبة'}
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                            {disc.type === 'group' ? 'مناقشة جماعية' : 'مناقشة فردية'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          تاريخ الطلب: {formatUmmAlQuraDate(disc.requestDate)} ({formatArabicDate(disc.requestDate)})
                          {disc.scheduledDate && (
                            <span className="text-blue-700 font-bold mr-2">
                              • موعد المناقشة: {formatArabicDate(disc.scheduledDate)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>

                      {disc.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                          <span>+{disc.pointsAwarded} نقطة</span>
                        </span>
                      )}

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50 space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[10px] block">المشرف المسؤول</span>
                          <strong className="text-slate-800">{getSupervisorName(disc.supervisorId)}</strong>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[10px] block">الموعد المحدد</span>
                          <strong className="text-slate-800">
                            {disc.scheduledDate ? formatArabicDate(disc.scheduledDate) : 'لم يُحدد بعد'}
                          </strong>
                          {disc.scheduledNote && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">{disc.scheduledNote}</span>
                          )}
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[10px] block">تاريخ تنفيذ المناقشة</span>
                          <strong className="text-slate-800">
                            {disc.discussionDate ? formatUmmAlQuraDate(disc.discussionDate) : '—'}
                          </strong>
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                          <span className="text-slate-400 text-[10px] block">الدرجة والنقاط</span>
                          <strong className="text-wathba-800 font-black">
                            {disc.evaluation.length > 0
                              ? `${disc.totalScore} / ${disc.maxScore || discussionSettings.totalMaxPoints}`
                              : 'لم تُقيّم بعد'}
                          </strong>
                          {disc.status === 'approved' ? (
                            <span className="block text-[10px] font-bold text-emerald-700 mt-0.5">
                              نقاط معتمدة: +{disc.pointsAwarded} نقطة ✅
                            </span>
                          ) : (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              النقاط تضاف بعد الاعتماد
                            </span>
                          )}
                        </div>
                      </div>

                      {disc.discussionSummary && (
                        <div className="bg-white rounded-xl p-3.5 border border-slate-200">
                          <p className="text-[11px] font-black text-slate-800 mb-1 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-wathba-600" />
                            <span>ملخص المناقشة:</span>
                          </p>
                          <p className="text-slate-700 leading-relaxed">{disc.discussionSummary}</p>
                        </div>
                      )}

                      {disc.evaluation.length > 0 && (
                        <div className="bg-white rounded-xl p-3.5 border border-slate-200 space-y-2">
                          <p className="text-[11px] font-black text-slate-800">تفاصيل درجات التقييم:</p>
                          <div className="space-y-1.5">
                            {disc.evaluation.map((ev, i) => (
                              <div key={i} className="flex items-center justify-between text-xs border-b border-slate-100 last:border-0 pb-1.5 last:pb-0">
                                <span className="text-slate-700 font-medium">{ev.name}</span>
                                <span className="font-black text-wathba-800 font-mono">
                                  {ev.awardedPoints} / {ev.maxPoints}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {disc.studentBenefit && (
                        <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200">
                          <p className="text-[11px] font-black text-emerald-800 mb-1 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>الفائدة التي خرجت بها من الكتاب:</span>
                          </p>
                          <p className="text-emerald-900 leading-relaxed">{disc.studentBenefit}</p>
                        </div>
                      )}

                      {disc.supervisorNotes && (
                        <div className="bg-wathba-50 rounded-xl p-3.5 border border-wathba-200">
                          <p className="text-[11px] font-black text-wathba-900 mb-1">ملاحظات المشرف:</p>
                          <p className="text-wathba-800 leading-relaxed whitespace-pre-line">{disc.supervisorNotes}</p>
                        </div>
                      )}

                      {disc.supervisorRecommendations && (
                        <div className="bg-purple-50 rounded-xl p-3.5 border border-purple-200">
                          <p className="text-[11px] font-black text-purple-900 mb-1">توصيات المشرف:</p>
                          <p className="text-purple-800 leading-relaxed">{disc.supervisorRecommendations}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: طلب إعادة مناقشة بمبرر لكتاب معتمد سابقاً */}
      {rediscussTarget && (
        <Modal
          isOpen={!!rediscussTarget}
          onClose={() => {
            setRediscussTarget(null);
            setRediscussReason('');
          }}
          title="طلب إعادة مناقشة الكتاب"
          subtitle={rediscussTarget.book.title}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRequestDiscussion(rediscussTarget.loan.id, rediscussTarget.book, rediscussReason);
            }}
            className="space-y-4"
          >
            <p className="text-xs text-slate-600 leading-relaxed">
              سبقت مناقشة هذا الكتاب. يرجى كتابة مبرر واضح لإعادة المناقشة (مثل الرغبة في تحسين الدرجة أو تلخيص محاور جديدة) ليراجعه المشرف.
            </p>
            <textarea
              rows={3}
              required
              value={rediscussReason}
              onChange={(e) => setRediscussReason(e.target.value)}
              placeholder="اكتب مبرر إعادة المناقشة هنا..."
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-wathba-500"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRediscussTarget(null);
                  setRediscussReason('');
                }}
              >
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />}>
                إرسال الطلب
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
