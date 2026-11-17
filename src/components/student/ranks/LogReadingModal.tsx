import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import {
  BookOpen,
  AlertCircle,
  CheckCircle2,
  Send,
  ShieldCheck,
  Award,
  Calendar,
} from 'lucide-react';

interface LogReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogReadingModal: React.FC<LogReadingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentStudent } = useAuth();
  const {
    loans,
    copies,
    books,
    getBookReadingCoverage,
    getStudentRankSummary,
    submitReadingLog,
  } = useLibrary();
  const { showToast } = useNotifications();

  // إعارات الطالب الفعلية غير الملغاة
  const studentLoans = currentStudent
    ? (loans || []).filter(
        (l) => l.studentId === currentStudent.id && l.status !== 'cancelled'
      )
    : [];

  const uniqueBookLoans = studentLoans.reduce<
    { loanId: string; bookId: string; title: string; pageCount: number; status: string }[]
  >((acc, loan) => {
    const copy = copies.find((c) => c.id === loan.copyId);
    const book = books.find((b) => b.id === copy?.bookId);
    if (!book) return acc;
    if (!acc.some((item) => item.bookId === book.id)) {
      acc.push({
        loanId: loan.id,
        bookId: book.id,
        title: book.title,
        pageCount: book.pageCount || 100,
        status: loan.status,
      });
    }
    return acc;
  }, []);

  const [selectedLoanId, setSelectedLoanId] = useState<string>(
    uniqueBookLoans[0]?.loanId || ''
  );
  const [fromPage, setFromPage] = useState<number>(1);
  const [toPage, setToPage] = useState<number>(15);
  const [readingDate, setReadingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedEntry = uniqueBookLoans.find((x) => x.loanId === selectedLoanId);
  const coverage =
    currentStudent && selectedEntry
      ? getBookReadingCoverage(currentStudent.id, selectedEntry.bookId)
      : null;

  const rankSummary = currentStudent
    ? getStudentRankSummary(currentStudent.id)
    : null;

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedLoanId && uniqueBookLoans.length > 0) {
      setSelectedLoanId(uniqueBookLoans[0].loanId);
    }
    setReadingDate(new Date().toISOString().slice(0, 10));
  }, [isOpen, uniqueBookLoans.length]);

  useEffect(() => {
    if (coverage) {
      const start = coverage.nextSuggestedFromPage;
      const suggestedEnd = Math.min(coverage.bookPageCount, start + 14);
      setFromPage(start);
      setToPage(Math.max(start, suggestedEnd));
      setErrorMsg(null);
    }
  }, [selectedLoanId, isOpen]);

  const pagesEntered =
    toPage >= fromPage && fromPage >= 1 ? toPage - fromPage + 1 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!currentStudent || !selectedEntry) {
      setErrorMsg('يرجى اختيار كتاب مستعار من مكتبتك');
      return;
    }

    setSubmitting(true);
    try {
      const res = submitReadingLog({
        studentId: currentStudent.id,
        loanId: selectedEntry.loanId,
        bookId: selectedEntry.bookId,
        fromPage,
        toPage,
        readingDate,
        studentNotes: notes,
      });

      if (res.success) {
        showToast(
          `تم إرسال طلب تسجيل (${pagesEntered} صفحة) بنجاح! 📖 ستُضاف إلى رصيدك فور اعتماد المشرف.`,
          'success',
          'تم إرسال طلب القراءة'
        );
        setNotes('');
        onClose();
      } else {
        setErrorMsg(res.error || 'تعذر تسجيل القراءة');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل صفحات القراءة المقروءة ✍️"
      subtitle="ربط الصفحات المقروءة بالكتاب وتاريخ القراءة تمهيداً لاعتماد المشرف"
      maxWidth="md"
    >
      {uniqueBookLoans.length === 0 ? (
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-sm text-slate-900">
              لا توجد لديك كتب مستعارة لتسجيل قراءتها حالياً
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              لا تُحتسب استعارة الكتاب وحدها؛ يجب قراءة كتاب مستعار من المكتبة وتسجيل صفحاته ثم اعتمادها من المشرف.
            </p>
          </div>
          <Button variant="secondary" size="md" onClick={onClose}>
            حسناً
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          {/* 1. اختيار الكتاب المستعار */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الكتاب المرتبط بالقراءة (من كتبك المستعارة):
            </label>
            <select
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-wathba-500 outline-none"
            >
              {uniqueBookLoans.map((item) => (
                <option key={item.loanId} value={item.loanId}>
                  {item.title} ({item.pageCount} صفحة) —{' '}
                  {item.status === 'active' ? 'مستعار حالياً' : 'تمت إعادته'}
                </option>
              ))}
            </select>
          </div>

          {/* 2. شريط تغطية الكتاب */}
          {coverage && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">تغطية صفحات الكتاب:</span>
                <span className="font-mono font-bold text-wathba-800">
                  إجمالي الكتاب: {coverage.bookPageCount} صفحة
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{
                    width: `${Math.min(100, (coverage.approvedPages / coverage.bookPageCount) * 100)}%`,
                  }}
                />
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{
                    width: `${Math.min(100, (coverage.pendingPages / coverage.bookPageCount) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="text-emerald-700 font-bold">معتمد: {coverage.approvedPages} ص</span>
                <span className="text-amber-700 font-bold">بانتظار الاعتماد: {coverage.pendingPages} ص</span>
                <span className="text-slate-600 font-bold">المتبقي: {coverage.remainingPages} ص</span>
              </div>

              {coverage.loggedRanges.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-400">نطاقات مسجلة مسبقاً:</span>
                  {coverage.loggedRanges.map((r, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      ص {r.fromPage}–{r.toPage}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. تاريخ القراءة ونطاق الصفحات */}
          {coverage && coverage.remainingPages === 0 ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>أحسنت! تم تسجيل كامل صفحات هذا الكتاب بالفعل. اختر كتاباً آخر!</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  بدأت من صفحة:
                </label>
                <input
                  type="number"
                  min={1}
                  max={coverage?.bookPageCount || 500}
                  value={fromPage}
                  onChange={(e) => setFromPage(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-center focus:ring-2 focus:ring-wathba-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وصلت إلى صفحة:
                </label>
                <input
                  type="number"
                  min={fromPage}
                  max={coverage?.bookPageCount || 500}
                  value={toPage}
                  onChange={(e) => setToPage(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-center focus:ring-2 focus:ring-wathba-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-wathba-700" />
                  <span>تاريخ القراءة:</span>
                </label>
                <input
                  type="date"
                  required
                  value={readingDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setReadingDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-center focus:ring-2 focus:ring-wathba-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* 4. معاينة الصفحات والأثر على الألقاب */}
          {pagesEntered > 0 && rankSummary && (
            <div className="p-3.5 rounded-2xl bg-wathba-50 border border-wathba-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-wathba-900 font-bold">
                <Award className="w-4 h-4 text-wathba-700" />
                <span>
                  المسجل: <strong>{pagesEntered} صفحة</strong>
                  {rankSummary.nextRank
                    ? ` (تُقربك من ${rankSummary.nextRank.title})`
                    : ''}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-wathba-700 text-white font-black">
                +{pagesEntered} صفحة
              </span>
            </div>
          )}

          {/* 5. ملاحظة اختيارية للمشرف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملخص قصير أو فكرة من قراءتك (اختياري):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="شارك مشرف المكتبة أجمل فائدة استمتعت بها في هذه الصفحات..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              تُضاف الصفحات إلى رصيدك التراكمي وتصدر شهادات الألقاب تلقائياً بعد مراجعة المشرف واعتماده للقراءة.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              disabled={pagesEntered <= 0 || (coverage ? coverage.remainingPages === 0 : false)}
              className="bg-wathba-700 hover:bg-wathba-800 text-white font-bold flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>إرسال طلب تسجيل القراءة</span>
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
