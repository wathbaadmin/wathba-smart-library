import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Loan, BookCopy, Book, Student, ConditionRating } from '../../types';
import { Search, CheckCircle, Camera, AlertTriangle, User, Calendar, BookOpen } from 'lucide-react';
import { formatArabicDate, isOverdue, formatUmmAlQuraDate, getLoanCountdown } from '../../lib/dateUtils';
import { ConditionInspectorModal } from '../inspection/ConditionInspectorModal';

interface DirectReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  supervisorId: string;
  preSelectedLoanId?: string;
  preSelectedCopyCode?: string;
}

export const DirectReturnModal: React.FC<DirectReturnModalProps> = ({
  isOpen,
  onClose,
  supervisorId,
  preSelectedLoanId,
  preSelectedCopyCode,
}) => {
  const { loans, copies, books, students, returnBook } = useLibrary();
  const { showToast } = useNotifications();

  const [search, setSearch] = useState(preSelectedCopyCode || '');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(preSelectedLoanId || null);
  const [showInspection, setShowInspection] = useState(false);

  // البحث عن الإعارات النشطة الحالية
  const activeLoans = loans.filter((l) => l.status === 'active');

  const matchingLoans = activeLoans.filter((loan) => {
    const copy = copies.find((c) => c.id === loan.copyId);
    const student = students.find((s) => s.id === loan.studentId);
    const book = books.find((b) => b.id === copy?.bookId);

    const term = search.toLowerCase().trim();
    return (
      copy?.copyCode.toLowerCase().includes(term) ||
      copy?.qrData.toLowerCase().includes(term) ||
      student?.fullName.includes(term) ||
      book?.title.toLowerCase().includes(term)
    );
  });

  const selectedLoan = selectedLoanId ? loans.find((l) => l.id === selectedLoanId) : null;
  const selectedCopy = selectedLoan ? copies.find((c) => c.id === selectedLoan.copyId) : null;
  const selectedBook = selectedCopy ? books.find((b) => b.id === selectedCopy.bookId) : null;
  const selectedStudent = selectedLoan ? students.find((s) => s.id === selectedLoan.studentId) : null;

  const handleReturnQuick = (rating: ConditionRating = 'good') => {
    if (!selectedLoanId) return;

    const res = returnBook({
      loanId: selectedLoanId,
      supervisorId,
      conditionRating: rating,
      details: 'استرجاع مباشر معتمد - تم توجيه النسخة لرف الفحص',
      sendToReturnShelf: true,
    });

    if (res.success) {
      showToast('تم استرجاع الكتاب بنجاح ونقله إلى رف الإرجاع والفحص!', 'success', 'استرجاع معتمد');
      onClose();
    } else {
      showToast(res.error || 'تعذر استرجاع الكتاب', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="استرجاع كتاب وفحصه (Direct Return)"
      subtitle="استلام النسخة من الطالب وتوثيق سلامتها ونقلها لرف الإرجاع"
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Search for active loan */}
        {!selectedLoan ? (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              اختر أو امسح النسخة المستعارة المراد استرجاعها:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث برمز النسخة (WTH-125-001) أو اسم الطالب أو عنوان الكتاب..."
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-wathba-500 focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
              {matchingLoans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  لا توجد إعارات نشطة تطابق بحثك حالياً
                </div>
              ) : (
                matchingLoans.map((loan) => {
                  const copy = copies.find((c) => c.id === loan.copyId);
                  const student = students.find((s) => s.id === loan.studentId);
                  const book = books.find((b) => b.id === copy?.bookId);
                  const late = isOverdue(loan.dueDate);

                  return (
                    <div
                      key={loan.id}
                      onClick={() => setSelectedLoanId(loan.id)}
                      className="p-3 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900">{book?.title}</div>
                        <div className="text-slate-500 flex items-center gap-2">
                          <span>النسخة: <strong className="font-mono">{copy?.copyCode}</strong></span>
                          <span>•</span>
                          <span>المستعير: <strong>{student?.fullName}</strong></span>
                        </div>
                      </div>
                      <div className="text-left space-y-0.5">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border inline-block ${getLoanCountdown(loan.dueDate).badgeColorClass}`}>
                          {getLoanCountdown(loan.dueDate).label}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 block">
                          {formatUmmAlQuraDate(loan.dueDate)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Selected Loan Info Summary */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={selectedBook?.coverImageUrl}
                  alt={selectedBook?.title}
                  className="w-16 h-24 object-cover rounded-xl border border-slate-200 shrink-0"
                />
                <div className="space-y-1 text-right">
                  <h4 className="font-black text-sm text-slate-900">{selectedBook?.title}</h4>
                  <div className="text-xs text-slate-600">
                    رمز النسخة: <strong className="font-mono">{selectedCopy?.copyCode}</strong>
                  </div>
                  <div className="text-xs text-slate-600">
                    الطالب المستعير: <strong>{selectedStudent?.fullName}</strong> ({selectedStudent?.grade})
                  </div>
                  <div className="text-[11px] text-slate-500">
                    تاريخ التسليم: {formatUmmAlQuraDate(selectedLoan.loanDate)} • موعد الاستحقاق: {formatUmmAlQuraDate(selectedLoan.dueDate)} ({getLoanCountdown(selectedLoan.dueDate).label})
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLoanId(null)}>
                اختيار كتاب آخر
              </Button>
            </div>

            {/* Condition Options Banner */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
              <h5 className="font-bold text-xs text-amber-900 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                توجيه النسخة إلى «رف الإرجاع والفحص»
              </h5>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                وفقاً لمتطلبات حماية كتب وثبة، تنتقل النسخة تلقائياً بعد استلامها إلى رف الإرجاع المؤقت لتخضع للفحص الشامل والتأكد من سلامة الغلاف والصفحات قبل إتاحتها للطلاب مجدداً.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button
                variant="royal"
                size="md"
                icon={<Camera className="w-4 h-4" />}
                onClick={() => setShowInspection(true)}
              >
                فحص تفصيلي وتصوير التلف / الحالة 📷
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="md" onClick={onClose}>
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleReturnQuick('good')}
                  icon={<CheckCircle className="w-4 h-4" />}
                >
                  استرجاع سليم سريع
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inspection Modal */}
      {showInspection && selectedCopy && (
        <ConditionInspectorModal
          isOpen={showInspection}
          onClose={() => setShowInspection(false)}
          copy={selectedCopy}
          student={selectedStudent || undefined}
          stage="return"
          onConfirm={(data) => {
            setShowInspection(false);
            if (!selectedLoanId) return;
            returnBook({
              loanId: selectedLoanId,
              supervisorId,
              conditionRating: data.rating,
              details: data.notes,
              photos: data.photos,
              sendToReturnShelf: data.rating !== 'damaged' && data.rating !== 'lost',
            });
            showToast('تم توثيق فحص النسخة واسترجاعها بنجاح!', 'success');
            onClose();
          }}
        />
      )}
    </Modal>
  );
};
