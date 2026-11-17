import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Student, BookCopy, Book, ConditionRating } from '../../types';
import { QrCode, Search, CheckCircle, AlertCircle, User, BookOpen } from 'lucide-react';
import { ConditionInspectorModal } from '../inspection/ConditionInspectorModal';

interface DirectCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  supervisorId: string;
  preSelectedStudent?: Student;
  preSelectedCopy?: BookCopy;
}

export const DirectCheckoutModal: React.FC<DirectCheckoutModalProps> = ({
  isOpen,
  onClose,
  supervisorId,
  preSelectedStudent,
  preSelectedCopy,
}) => {
  const { students, copies, books, checkoutBook, isStudentEligibleForLoan } = useLibrary();
  const { showToast } = useNotifications();

  const [studentSearch, setStudentSearch] = useState('');
  const [copySearch, setCopySearch] = useState('');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(preSelectedStudent || null);
  const [selectedCopy, setSelectedCopy] = useState<BookCopy | null>(preSelectedCopy || null);
  const [notes, setNotes] = useState('');
  const [showInspection, setShowInspection] = useState(false);

  // البحث عن الطلاب
  const matchingStudents = students.filter(
    (s) =>
      s.status === 'active' &&
      (s.fullName.includes(studentSearch) ||
        s.internalId.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.groupName.includes(studentSearch))
  );

  // البحث عن النسخ المتاحة فقط
  const matchingCopies = copies.filter(
    (c) =>
      (c.status === 'available' || c.status === 'reserved' || c.status === 'in_preparation') &&
      (c.copyCode.toLowerCase().includes(copySearch.toLowerCase()) ||
        c.qrData.toLowerCase().includes(copySearch.toLowerCase()))
  );

  const selectedBook = selectedCopy ? books.find((b) => b.id === selectedCopy.bookId) : null;
  const eligibility = selectedStudent ? isStudentEligibleForLoan(selectedStudent.id) : null;

  const handleExecuteCheckout = (inspectionData?: { rating: ConditionRating; notes: string; photos: string[] }) => {
    if (!selectedStudent || !selectedCopy) return;

    const res = checkoutBook({
      copyId: selectedCopy.id,
      studentId: selectedStudent.id,
      supervisorId,
      conditionRating: inspectionData?.rating || 'good',
      conditionNotes: inspectionData?.notes || notes,
      photos: inspectionData?.photos || [],
    });

    if (res.success) {
      showToast('تمت عملية تسليم الكتاب بنجاح وحفظها في قاعدة البيانات!', 'success', 'إعارة معتمدة');
      onClose();
    } else {
      showToast(res.error || 'فشلت عملية الإعارة', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسليم كتاب مباشر (Direct Checkout)"
      subtitle="مسح أو اختيار الطالب والنسخة للتحقق من الصلاحيات وتوثيق الإعارة"
      maxWidth="xl"
    >
      <div className="space-y-6">
        {/* Step 1: Select Student */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            الخطوة 1: اختيار الطالب المستلم
          </label>
          {selectedStudent ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">{selectedStudent.fullName}</div>
                  <div className="text-xs text-slate-500">
                    {selectedStudent.grade} • {selectedStudent.groupName} ({selectedStudent.internalId})
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                تغيير الطالب
              </Button>
            </div>
          ) : (
            <div>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="ابحث باسم الطالب، رقمه الداخلي، أو مجموعته..."
                  className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-wathba-500 focus:outline-none"
                />
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {matchingStudents.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <span className="font-bold text-slate-800">{s.fullName}</span>
                    <span className="text-slate-500">
                      {s.grade} • {s.groupName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Eligibility Warning */}
        {selectedStudent && eligibility && !eligibility.eligible && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span><strong>لا يمكن الإعارة:</strong> {eligibility.reason}</span>
          </div>
        )}

        {/* Step 2: Select Copy */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-800">
            الخطوة 2: اختيار النسخة الورقية المتاحة
          </label>
          {selectedCopy ? (
            <div className="p-3.5 rounded-2xl bg-royal-50 border border-royal-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-royal-600 text-white flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">{selectedBook?.title}</div>
                  <div className="text-xs text-slate-500">
                    رمز النسخة: <strong className="font-mono">{selectedCopy.copyCode}</strong> • الرف: {selectedCopy.shelfLocation}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCopy(null)}>
                تغيير النسخة
              </Button>
            </div>
          ) : (
            <div>
              <div className="relative mb-2">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={copySearch}
                  onChange={(e) => setCopySearch(e.target.value)}
                  placeholder="ابحث برمز النسخة مثل WTH-125-001..."
                  className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-wathba-500 focus:outline-none"
                />
              </div>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {matchingCopies.slice(0, 5).map((c) => {
                  const b = books.find((bk) => bk.id === c.bookId);
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCopy(c)}
                      className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{b?.title}</span>
                        <span className="font-mono text-slate-500 mr-2">({c.copyCode})</span>
                      </div>
                      <Badge status={c.status} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ملاحظات التسليم (اختياري):
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: تسليم ضمن النشاط الصباحي، نسخة بغلاف بلاستيكي جديد..."
            className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-wathba-500 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Button
            variant="secondary"
            size="md"
            disabled={!selectedCopy || !selectedStudent}
            onClick={() => setShowInspection(true)}
          >
            توثيق حالة النسخة وتصويرها أولاً 📷
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!selectedStudent || !selectedCopy || !eligibility?.eligible}
              onClick={() => handleExecuteCheckout()}
              icon={<CheckCircle className="w-4 h-4" />}
            >
              تأكيد التسليم المباشر
            </Button>
          </div>
        </div>
      </div>

      {/* Inspection Modal if supervisor wants to take pre-checkout photos */}
      {showInspection && selectedCopy && (
        <ConditionInspectorModal
          isOpen={showInspection}
          onClose={() => setShowInspection(false)}
          copy={selectedCopy}
          student={selectedStudent || undefined}
          stage="checkout"
          onConfirm={(data) => {
            setShowInspection(false);
            handleExecuteCheckout(data);
          }}
        />
      )}
    </Modal>
  );
};
