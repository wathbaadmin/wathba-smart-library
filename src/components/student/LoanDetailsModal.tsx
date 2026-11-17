import React from 'react';
import { Loan, Book, BookCopy } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { getLoanCountdown, formatArabicDate, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { getDiscussionStatusMeta } from '../../lib/discussionUtils';
import {
  BookOpen,
  Calendar,
  ShieldCheck,
  Info,
  RotateCcw,
  ArrowLeftRight,
  MessageSquareText,
} from 'lucide-react';

interface LoanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan;
  book?: Book;
  copy?: BookCopy;
  onOpenReturn?: () => void;
  onOpenExchange?: () => void;
}

export const LoanDetailsModal: React.FC<LoanDetailsModalProps> = ({
  isOpen,
  onClose,
  loan,
  book,
  copy,
  onOpenReturn,
  onOpenExchange,
}) => {
  const { discussions, discussionSettings, requestDiscussion, students } = useLibrary();
  const { showToast, addNotification } = useNotifications();
  const countdown = getLoanCountdown(loan.dueDate);

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
      showToast('تم إرسال طلب مناقشة الكتاب للمشرف بنجاح! 💬', 'success');
    } else {
      showToast(res.error || 'تعذر تقديم الطلب', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تفاصيل الكتاب المستعار وموعد الإرجاع"
      subtitle={`سجل الإعارة رقم #${loan.id.slice(0, 8)}`}
      maxWidth="md"
    >
      <div className="space-y-5 text-right">
        {/* Book Header Card */}
        <div className="p-4 rounded-2xl bg-wathba-50/70 border border-wathba-200/80 flex items-center gap-3.5">
          <div className="w-14 h-18 rounded-xl bg-gradient-to-tr from-wathba-800 to-wathba-600 text-white flex items-center justify-center shadow-soft shrink-0">
            <BookOpen className="w-7 h-7 text-wathba-100" />
          </div>
          <div>
            <span className="font-mono text-[10px] text-slate-400 font-bold block">
              رمز النسخة: {copy?.copyCode || '-'}
            </span>
            <h3 className="font-black text-sm text-slate-900 leading-snug">
              {book?.title || 'كتاب مستعار'}
            </h3>
            {book?.author && (
              <span className="text-xs text-slate-500 block mt-0.5">
                تأليف: {book.author}
              </span>
            )}
            <span className="text-[11px] text-wathba-700 font-bold block mt-1">
              موقع الرف: {copy?.shelfLocation || 'الرف العام'}
            </span>
          </div>
        </div>

        {/* Countdown & Due Date Hero Alert */}
        <div className={`p-4 rounded-2xl border ${countdown.borderColorClass} ${countdown.bgColorClass} space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">حالة الإعارة الحالية:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-black border ${countdown.badgeColorClass}`}>
              {countdown.label}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-200/60 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">موعد الإرجاع بالتقويم الهجري (أم القرى):</span>
              <strong className="font-bold text-slate-900 text-sm">
                {countdown.hijriDate}
              </strong>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>الموافق بالميلادي:</span>
              <span className="font-mono font-bold text-slate-600">{countdown.gregorianDate}</span>
            </div>
          </div>
        </div>

        {/* Loan Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 text-[10px] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-wathba-600" />
              <span>تاريخ بدء الاستعارة:</span>
            </div>
            <div className="font-bold text-slate-800 text-[11px]">
              {formatUmmAlQuraDate(loan.loanDate)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              ({formatArabicDate(loan.loanDate)})
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-400 text-[10px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-royal-600" />
              <span>حالة النسخة عند الاستلام:</span>
            </div>
            <div className="font-bold text-slate-800 text-[11px]">
              سليمة وممتازة
            </div>
            <div className="text-[10px] text-emerald-600 font-bold">
              جاهزة للقراءة والاستمتاع
            </div>
          </div>
        </div>

        {/* Return Guidance Notice */}
        <div className="p-3.5 rounded-2xl bg-wathba-50/50 border border-wathba-100 text-xs text-wathba-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-wathba-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            عزيزي بطل القراءة: حافظ على صفحات الكتاب وغلافه نظيفاً، وسلّمه لمشرف المكتبة قبل نهاية الموعد لتتيح لزملائك الاستفادة منه 🌟
          </p>
        </div>

        {/* Request Return / Exchange / Discussion Actions */}
        {(onOpenReturn || onOpenExchange || book) && (
          <div className="space-y-2.5 pt-1">
            {(onOpenReturn || onOpenExchange) && (
              <div className="grid grid-cols-2 gap-3">
                {onOpenReturn && (
                  <button
                    type="button"
                    onClick={onOpenReturn}
                    className="py-2.5 px-3 rounded-xl bg-wathba-700 hover:bg-wathba-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>تقديم طلب إرجاع</span>
                  </button>
                )}

                {onOpenExchange && (
                  <button
                    type="button"
                    onClick={onOpenExchange}
                    className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-slate-600" />
                    <span>طلب استبدال</span>
                  </button>
                )}
              </div>
            )}

            {book && (
              existingBookDiscussion && discMeta ? (
                <div className={`w-full py-2 px-3 rounded-xl border text-xs font-bold text-center ${discMeta.badgeClass}`}>
                  حالة مناقشة الكتاب: {discMeta.label}
                  {existingBookDiscussion.status === 'approved' &&
                    ` (+${existingBookDiscussion.pointsAwarded} نقطة)`}
                </div>
              ) : (
                discussionSettings.isEnabled && (
                  <button
                    type="button"
                    onClick={handleRequestDiscussion}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <MessageSquareText className="w-4 h-4" />
                    <span>أنهيت القراءة؟ طلب مناقشة الكتاب</span>
                  </button>
                )
              )
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            className="w-full text-xs font-bold"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </Modal>
  );
};
