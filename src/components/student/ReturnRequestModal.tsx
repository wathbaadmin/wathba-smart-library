import React, { useState } from 'react';
import { Loan, Book, BookCopy } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { getLoanCountdown } from '../../lib/dateUtils';
import {
  RotateCcw,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Info,
  Sparkles,
  Send,
} from 'lucide-react';

interface ReturnRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan;
  book?: Book;
  copy?: BookCopy;
  onSuccess?: () => void;
}

export const ReturnRequestModal: React.FC<ReturnRequestModalProps> = ({
  isOpen,
  onClose,
  loan,
  book,
  copy,
  onSuccess,
}) => {
  const { submitReturnRequest } = useLibrary();
  const { showToast } = useNotifications();

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const countdown = getLoanCountdown(loan.dueDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = submitReturnRequest(loan.id, notes);
      if (res.success) {
        showToast(
          'تم إرسال طلب الإرجاع بنجاح! 📖 سيقوم المشرف بمراجعته وتحديد موعد الاستلام.',
          'success',
          'تم تقديم الطلب'
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.error || 'تعذر تقديم طلب الإرجاع', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="طلب إرجاع كتاب مستعار"
      subtitle="تقديم إشعار رسمي للمكتبة برغبتك في تسليم الكتاب"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-right">
        {/* Book Details Summary Card */}
        <div className="p-4 rounded-2xl bg-wathba-50/70 border border-wathba-200/80 flex items-center gap-3.5">
          <div className="w-14 h-18 rounded-xl bg-gradient-to-tr from-wathba-800 to-wathba-600 text-white flex items-center justify-center shadow-soft shrink-0">
            <BookOpen className="w-7 h-7 text-wathba-100" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10px] text-slate-400 font-bold block">
              رمز النسخة: {copy?.copyCode || '-'}
            </span>
            <h4 className="font-black text-sm text-slate-900 truncate">
              {book?.title || 'كتاب مستعار'}
            </h4>
            {book?.author && (
              <span className="text-xs text-slate-500 block truncate mt-0.5">
                تأليف: {book.author}
              </span>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${countdown.badgeColorClass}`}>
                {countdown.label}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                موعد الإرجاع: {countdown.hijriDate}
              </span>
            </div>
          </div>
        </div>

        {/* Note Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            ملاحظات أو وقت مناسب لتسليم الكتاب للمشرف (اختياري):
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="مثال: انتهيت من قراءة الكتاب وهو بحالة ممتازة، وسأسلمه في حصة الفسحة المدرسية..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Regulatory & Safety Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            <strong>تنبيه نظامي:</strong> تقديم طلب الإرجاع لا يُسقط الإعارة عنك فوراً؛ ستظل النسخة مسجلة بعهدتك في سجلات المكتبة حتى يتسلمها المشرف يدوياً ويفحص سلامتها ثم يعتمد الإرجاع النهائي.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={submitting}
            className="text-xs font-bold"
          >
            إلغاء
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            className="text-xs font-bold flex items-center gap-2 bg-wathba-700 hover:bg-wathba-800 text-white"
          >
            <Send className="w-3.5 h-3.5" />
            <span>تأكيد وإرسال طلب الإرجاع</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
