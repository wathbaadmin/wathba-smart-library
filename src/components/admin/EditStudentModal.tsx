import React, { useState, useEffect } from 'react';
import { Student, AccountStatus } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CheckCircle, QrCode, ShieldCheck } from 'lucide-react';

interface EditStudentModalProps {
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
  onSave: (updated: Student) => void;
  onOpenQrManager?: (student: Student) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  student,
  onClose,
  onSave,
  onOpenQrManager,
}) => {
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('الصف الرابع');
  const [stage, setStage] = useState('الابتدائية');
  const [groupName, setGroupName] = useState('');
  const [status, setStatus] = useState<AccountStatus>('active');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !student) return;
    setFullName(student.fullName || '');
    setGrade(student.grade || 'الصف الرابع');
    setStage(student.stage || 'الابتدائية');
    setGroupName(student.groupName || '');
    setStatus(student.status || 'active');
    setNotes(student.notes || '');
    setError(null);
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('يرجى إدخال اسم الطالب.');
      return;
    }

    onSave({
      ...student,
      fullName: fullName.trim(),
      grade,
      stage: stage.trim() || 'الابتدائية',
      groupName: groupName.trim() || 'فرسان وثبة',
      status,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`تعديل بيانات الطالب: ${student.fullName}`}
      subtitle={`كود الطالب: ${student.internalId}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 text-right">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">اسم الطالب ثلاثي: *</label>
          <input
            type="text"
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">الصف الدراسي:</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            >
              <option value="الصف الأول">الصف الأول</option>
              <option value="الصف الثاني">الصف الثاني</option>
              <option value="الصف الثالث">الصف الثالث</option>
              <option value="الصف الرابع">الصف الرابع</option>
              <option value="الصف الخامس">الصف الخامس</option>
              <option value="الصف السادس">الصف السادس</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">المرحلة:</label>
            <input
              type="text"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">المجموعة القرائية:</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">حالة الحساب:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AccountStatus)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            >
              <option value="active">نشط ومفعّل</option>
              <option value="suspended">موقوف مؤقتاً</option>
              <option value="archived">مؤرشف</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">ملاحظات:</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
          />
        </div>

        {/* تنبيه ثبات الباركود + رابط إدارته */}
        <div className="p-3.5 rounded-2xl bg-[#f4f7f9] border border-[#dde6ed] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-[#3b707d] shrink-0 mt-0.5" />
            <span>
              باركود الدخول الخاص بالطالب ثابت ومستقل، ولن يتغير عند تعديل اسمه أو مجموعته.
            </span>
          </div>
          {onOpenQrManager && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<QrCode className="w-3.5 h-3.5" />}
              onClick={() => {
                onClose();
                onOpenQrManager(student);
              }}
              className="shrink-0"
            >
              إدارة QR
            </Button>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            icon={<CheckCircle className="w-4 h-4" />}
          >
            حفظ التعديلات
          </Button>
        </div>
      </form>
    </Modal>
  );
};
