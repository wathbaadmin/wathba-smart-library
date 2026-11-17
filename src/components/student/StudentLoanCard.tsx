import React, { useState } from 'react';
import { Loan, Book, BookCopy } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { getLoanCountdown } from '../../lib/dateUtils';
import { getDiscussionStatusMeta } from '../../lib/discussionUtils';
import { LoanDetailsModal } from './LoanDetailsModal';
import { ReturnRequestModal } from './ReturnRequestModal';
import { ExchangeRequestModal } from './ExchangeRequestModal';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  RotateCcw,
  ArrowLeftRight,
  MessageSquareText,
  CheckCircle,
  CheckCircle2,
  Clock,
  X,
} from 'lucide-react';

interface StudentLoanCardProps {
  loan: Loan;
  book?: Book;
  copy?: BookCopy;
}

export const StudentLoanCard: React.FC<StudentLoanCardProps> = ({
  loan,
  book,
  copy,
}) => {
  const {
    discussions,
    discussionSettings,
    requestDiscussion,
    students,
    readingCompletions,
    requestReadingCompletion,
  } = useLibrary();
  const { showToast, addNotification } = useNotifications();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  const countdown = getLoanCountdown(loan.dueDate);

  // حالة إكمال قراءة هذا الكتاب
  const loanCompletion = (readingCompletions || []).find(
    (c) => (c.loanId && c.loanId === loan.id) || (book && c.studentId === loan.studentId && c.bookId === book.id)
  );

  const handleConfirmComplete = () => {
    setIsSubmittingComplete(true);
    try {
      const res = requestReadingCompletion({
        loanId: loan.id,
        studentId: loan.studentId,
        studentNotes: completionNotes,
      });
      if (res.success) {
        showToast('تم إرسال طلب إكمال الكتاب بنجاح، بانتظار اعتماد المشرف 📖', 'success');
        setConfirmCompleteOpen(false);
        setCompletionNotes('');
      } else {
        showToast(res.error || 'تعذر تسجيل طلب الإكمال', 'error');
      }
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const existingBookDiscussion = book
    ? discussions.find(
        (d) => d.studentId === loan.studentId && d.bookId === book.id && d.status !== 'cancelled'
      )
    : undefined;
  const discMeta = existingBookDiscussion
    ? getDiscussionStatusMeta(existingBookDiscussion.status)
    : null;

  const handleRequestDiscussion = () => {
    if (!book) return;
    const res = requestDiscussion({
      loanId: loan.id,
      bookId: book.id,
      studentId: loan.studentId,
    });
    if (res.success) {
      const stu = students.find((s) => s.id === loan.studentId);
      if (discussionSettings.enableNotifications !== false) {
        addNotification({
          recipientType: 'staff',
          title: 'طلب مناقشة كتاب جديد 💬',
          message: `طلب الطالب ${stu?.fullName || 'طالب'} مناقشة كتاب "${book.title}".`,
          type: 'info',
          actionLink: 'discussions',
        });
      }
      showToast('تم إرسال طلب مناقشة الكتاب إلى المشرف بنجاح! 💬', 'success');
    } else {
      showToast(res.error || 'تعذر تقديم طلب المناقشة', 'error');
    }
  };

  // Determine progress bar styling
  const getProgressBarClass = () => {
    switch (countdown.status) {
      case 'safe':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      case 'today':
        return 'bg-amber-600 animate-pulse';
      case 'overdue':
        return 'bg-rose-500';
      default:
        return 'bg-emerald-500';
    }
  };

  return (
    <>
      <div
        onClick={() => setDetailsOpen(true)}
        className={`bg-white rounded-3xl border-2 p-5 shadow-soft hover:shadow-card transition-all cursor-pointer flex flex-col justify-between space-y-4 group ${countdown.borderColorClass} ${
          countdown.status === 'today' ? 'ring-2 ring-amber-200' : ''
        }`}
      >
        {/* Top Header: Book Info & Countdown Badge */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-16 rounded-2xl bg-gradient-to-tr from-wathba-800 to-wathba-600 text-white flex items-center justify-center font-bold shadow-soft shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6 text-wathba-100" />
              </div>
              <div className="text-right min-w-0">
                <span className="font-mono text-[10px] text-slate-400 font-bold block truncate">
                  {copy?.copyCode || book?.code || 'نسخة ورقية'}
                </span>
                <h4 className="font-black text-sm text-slate-900 leading-snug group-hover:text-wathba-700 transition-colors truncate">
                  {book?.title || 'كتاب مستعار'}
                </h4>
                {book?.author && (
                  <span className="text-[11px] text-slate-500 block truncate max-w-[160px]">
                    {book.author}
                  </span>
                )}
              </div>
            </div>

            {/* Visual Countdown Badge with specific color scheme */}
            <span
              className={`px-3 py-1 rounded-full text-xs font-black border shrink-0 transition-all shadow-sm ${countdown.badgeColorClass}`}
            >
              {countdown.label}
            </span>
          </div>

          {/* Hijri Umm Al-Qura Date Box */}
          <div className={`p-3 rounded-2xl border ${countdown.borderColorClass} ${countdown.bgColorClass} flex items-center justify-between text-xs`}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-wathba-700 shrink-0" />
              <span className="text-slate-600 font-medium">موعد الإرجاع:</span>
            </div>
            <div className="text-left">
              <strong className="font-black text-slate-900 block text-xs sm:text-sm">
                {countdown.hijriDate}
              </strong>
              <span className="text-[10px] text-slate-400 font-mono block">
                ({countdown.gregorianDate}م)
              </span>
            </div>
          </div>
        </div>

        {/* Visual Proximity / Progress Timeline Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressBarClass()}`}
              style={{ width: `${countdown.progressPercent}%` }}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span>اضغط لعرض التفاصيل الكاملة</span>
            <span className="text-wathba-700 font-bold flex items-center gap-0.5 group-hover:-translate-x-1 transition-transform">
              <span>تفاصيل الإعارة</span>
              <ChevronLeft className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Action Buttons for Return, Exchange, Completion & Discussion */}
        <div className="pt-2 border-t border-slate-100 space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* زر وشارة إكمال الكتاب */}
          {loanCompletion?.status === 'approved' ? (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/90 active:scale-[0.99] transition-all text-emerald-900 border border-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              title="اضغط لعرض تفاصيل الإعارة والإكمال"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>أتممت قراءة هذا الكتاب (معتمد) ✅</span>
              <span className="text-[10px] text-emerald-700 font-medium mr-1.5">(عرض التفاصيل)</span>
            </button>
          ) : loanCompletion?.status === 'under_review' ? (
            <div className="w-full py-2.5 px-3 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold flex items-center justify-between gap-2 shadow-2xs px-3">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
                <span>إكمال الكتاب: قيد المراجعة من الإدارة</span>
              </span>
              <span className="text-[10px] bg-blue-200/60 px-2 py-0.5 rounded-md font-mono">قيد الفحص</span>
            </div>
          ) : loanCompletion?.status === 'needs_revision' ? (
            <div className="w-full p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1 text-amber-800">
                  <Clock className="w-3.5 h-3.5" />
                  <span>الطلب يحتاج إلى استكمال</span>
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmCompleteOpen(true)}
                  className="px-2 py-0.5 rounded bg-amber-600 text-white text-[11px] font-bold hover:bg-amber-700"
                >
                  إعادة الإرسال
                </button>
              </div>
              {loanCompletion.revisionReason && (
                <p className="text-[11px] text-amber-700 bg-white/70 p-1.5 rounded-lg border border-amber-200">
                  ملاحظة المشرف: {loanCompletion.revisionReason}
                </p>
              )}
            </div>
          ) : loanCompletion?.status === 'rejected' ? (
            <div className="w-full p-2.5 rounded-xl bg-rose-50 text-rose-900 border border-rose-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-rose-800">تم رفض طلب الإكمال السابق</span>
                <button
                  type="button"
                  onClick={() => setConfirmCompleteOpen(true)}
                  className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700"
                >
                  تقديم طلب جديد
                </button>
              </div>
              {loanCompletion.rejectionReason && (
                <p className="text-[11px] text-rose-700 bg-white/70 p-1.5 rounded-lg border border-rose-200">
                  سبب الرفض: {loanCompletion.rejectionReason}
                </p>
              )}
            </div>
          ) : loanCompletion?.status === 'new' || loanCompletion?.status === 'pending_approval' ? (
            <div className="w-full py-2.5 px-3 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold flex items-center justify-between gap-2 shadow-2xs px-3">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                <span>إكمال الكتاب: بانتظار اعتماد المشرف</span>
              </span>
              <span className="text-[10px] bg-amber-200/60 px-2 py-0.5 rounded-md font-mono">طلب جديد</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCompleteOpen(true)}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#2c5661] to-[#3b707d] hover:from-[#1c353d] hover:to-[#2c5661] text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>إكمال الكتاب</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReturnModalOpen(true)}
              className="w-full min-h-[44px] py-2.5 px-2.5 rounded-xl bg-[#e3ecf3]/70 hover:bg-[#e3ecf3] text-[#284d57] text-xs font-bold border border-[#e3ecf3] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>طلب إرجاع</span>
            </button>

            <button
              type="button"
              onClick={() => setExchangeModalOpen(true)}
              className="w-full min-h-[44px] py-2.5 px-2.5 rounded-xl bg-[#f6f8fa] hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <ArrowLeftRight className="w-4 h-4 shrink-0" />
              <span>طلب استبدال</span>
            </button>
          </div>

          {book && (
            existingBookDiscussion && discMeta ? (
              <div className={`w-full py-2 px-3 rounded-xl border text-xs font-bold text-center ${discMeta.badgeClass}`}>
                المناقشة: {discMeta.label}
                {existingBookDiscussion.status === 'approved' &&
                  ` (+${existingBookDiscussion.pointsAwarded} نقطة)`}
              </div>
            ) : (
              discussionSettings.isEnabled && (
                <button
                  type="button"
                  onClick={handleRequestDiscussion}
                  className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <MessageSquareText className="w-4 h-4 shrink-0 text-[#3b707d]" />
                  <span>طلب مناقشة الكتاب</span>
                </button>
              )
            )
          )}
        </div>
      </div>

      {/* Confirmation Modal: Book Reading Completion */}
      {confirmCompleteOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setConfirmCompleteOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-l from-[#1c353d] to-[#2c5661] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-sm">تأكيد إكمال قراءة الكتاب</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmCompleteOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#f4f7f9] border border-[#dde6ed] space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block font-mono">
                  {copy?.copyCode || book?.code}
                </span>
                <h4 className="font-black text-sm text-[#1c353d]">{book?.title || 'كتاب مستعار'}</h4>
                {book?.author && (
                  <p className="text-xs text-slate-500 font-medium">المؤلف: {book.author}</p>
                )}
                {book?.pageCount && (
                  <p className="text-[11px] text-slate-400 font-mono">
                    عدد الصفحات: {book.pageCount} صفحة
                  </p>
                )}
              </div>

              <div className="text-center py-1">
                <p className="text-sm font-black text-slate-800">
                  هل أنت متأكد أنك أتممت قراءة هذا الكتاب؟
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  سيتم إرسال طلب اعتماد للمشرف، وبعد مراجعته سيُضاف الكتاب إلى «سجل قراءاتي» المعتمدة.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظات أو أهم الفوائد التي خرجت بها (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="اكتب بإيجاز ما أعجبك في الكتاب أو أهم فكرة تعلمتها..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-[#3b707d] resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingComplete}
                  onClick={handleConfirmComplete}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#2c5661] hover:bg-[#1c353d] text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>نعم، أتممت قراءة الكتاب</span>
                </button>
                <button
                  type="button"
                  disabled={isSubmittingComplete}
                  onClick={() => setConfirmCompleteOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                >
                  تراجع
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsOpen && (
        <LoanDetailsModal
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          loan={loan}
          book={book}
          copy={copy}
          onOpenReturn={() => {
            setDetailsOpen(false);
            setReturnModalOpen(true);
          }}
          onOpenExchange={() => {
            setDetailsOpen(false);
            setExchangeModalOpen(true);
          }}
        />
      )}

      {/* Return Request Modal */}
      {returnModalOpen && (
        <ReturnRequestModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          loan={loan}
          book={book}
          copy={copy}
        />
      )}

      {/* Exchange Request Modal */}
      {exchangeModalOpen && (
        <ExchangeRequestModal
          isOpen={exchangeModalOpen}
          onClose={() => setExchangeModalOpen(false)}
          loan={loan}
          book={book}
          copy={copy}
        />
      )}
    </>
  );
};
