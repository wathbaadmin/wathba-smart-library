import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Student } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  generateStudentAccessCode,
  generateUniqueStudentCode,
  normalizeStudentCode,
} from '../../lib/studentAuthService';
import {
  CheckCircle,
  Hash,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Eye,
  EyeOff,
  QrCode,
  Printer,
} from 'lucide-react';
import { QRCodeView } from '../qr/QRCodeView';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCount?: number;
  onAddStudent: (
    data: Omit<Student, 'id' | 'totalBooksRead' | 'currentActiveLoans' | 'createdAt' | 'qrToken' | 'accessCodeHash'> & {
      customAccessCode?: string;
    }
  ) => Student | void;
  onPrintCard?: (student: Student) => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  onClose,
  onAddStudent,
  onPrintCard,
}) => {
  const { students, isStudentCodeAvailable, issuedStudentCredentials } = useLibrary();
  const { showToast } = useNotifications();

  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('الصف الرابع');
  const [stage, setStage] = useState('الابتدائية');
  const [groupName, setGroupName] = useState('فرسان وثبة');
  const [internalId, setInternalId] = useState('');
  const [customAccessCode, setCustomAccessCode] = useState('');
  const [showPin, setShowPin] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [createdResult, setCreatedResult] = useState<{
    studentCode: string;
    plainPin: string;
    fullName: string;
    student?: Student;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFullName('');
    setGrade('الصف الرابع');
    setStage('الابتدائية');
    setGroupName('فرسان وثبة');
    setInternalId(generateUniqueStudentCode(students));
    setCustomAccessCode(generateStudentAccessCode(6));
    setNotes('');
    setFormError(null);
    setCreatedResult(null);
  }, [isOpen]);

  const handleRegenerateStudentCode = () => {
    setInternalId(generateUniqueStudentCode(students));
    setFormError(null);
  };

  const handleRegeneratePin = () => {
    setCustomAccessCode(generateStudentAccessCode(6));
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('يرجى إدخال اسم الطالب ثلاثياً قبل التأكيد');
      return;
    }

    const normCode = normalizeStudentCode(internalId);
    if (!normCode) {
      setFormError('يرجى إدخال كود الطالب الفريد أو استخدام التوليد التلقائي');
      return;
    }

    if (!isStudentCodeAvailable(normCode)) {
      setFormError(`كود الطالب "${normCode}" مستخدم لطالب آخر. يرجى اختيار كود فريد.`);
      return;
    }

    const cleanPin = customAccessCode.trim() || generateStudentAccessCode(6);
    if (cleanPin.length < 4) {
      setFormError('يجب ألا يقل رمز الدخول عن 4 أرقام أو أحرف');
      return;
    }

    const created = onAddStudent({
      fullName: fullName.trim(),
      grade,
      stage,
      groupName: groupName.trim() || 'فرسان وثبة',
      internalId: normCode,
      customAccessCode: cleanPin,
      status: 'active',
      notes: notes.trim(),
    });

    const finalCode = (created && 'internalId' in created ? created.internalId : normCode) || normCode;
    const savedCred = created ? issuedStudentCredentials[created.id] : undefined;

    setCreatedResult({
      studentCode: finalCode,
      plainPin: savedCred?.plainAccessCode || cleanPin,
      fullName: fullName.trim(),
      student: created && 'id' in created ? created : undefined,
    });
  };

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      showToast('تم النسخ بنجاح', 'success');
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      showToast('تعذر النسخ التلقائي للحافظة', 'warning');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={createdResult ? 'تمت إضافة الطالب وإصدار بيانات الدخول' : 'إضافة طالب جديد'}
      subtitle={
        createdResult
          ? 'احفظ كود الطالب ورمز الدخول وسلمهما للطالب (يُخزّن الرمز مشفراً داخل القاعدة)'
          : 'تحديد البيانات الأساسية وإصدار كود طالب فريد ورمز دخول مشفّر تلقائياً'
      }
      maxWidth="md"
    >
      {createdResult ? (
        <div className="space-y-4 text-right">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
            <div className="font-black text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>تم تسجيل الطالب: {createdResult.fullName}</span>
            </div>
            <p className="text-xs text-emerald-800">
              يُستخدم الكود ورمز الدخول أدناه لتسجيل الدخول إلى بوابة الطالب فوراً.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#dde6ed] space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">كود الطالب:</span>
              <div className="flex items-center justify-between gap-2">
                <strong className="font-mono text-base font-black text-[#284d57]" dir="ltr">
                  {createdResult.studentCode}
                </strong>
                <button
                  type="button"
                  onClick={() => copyText('code', createdResult.studentCode)}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-[#3b707d] hover:bg-[#e3ecf3]"
                >
                  {copiedKey === 'code' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#e3ecf3]/75 border border-[#c5d8df] space-y-1">
              <span className="text-[11px] font-bold text-[#284d57] block">رمز الدخول:</span>
              <div className="flex items-center justify-between gap-2">
                <strong className="font-mono text-base font-black text-slate-900 tracking-widest" dir="ltr">
                  {createdResult.plainPin}
                </strong>
                <button
                  type="button"
                  onClick={() => copyText('pin', createdResult.plainPin)}
                  className="p-2 rounded-lg bg-white border border-slate-200 text-[#3b707d] hover:bg-[#e3ecf3]"
                >
                  {copiedKey === 'pin' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {createdResult.student?.qrToken && (
            <div className="p-4 rounded-2xl bg-[#f4f7f9] border border-[#dde6ed] flex flex-col items-center gap-2">
              <span className="text-xs font-black text-[#1c353d] flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#3b707d]" />
                <span>باركود الدخول الخاص بالطالب (فريد وآمن)</span>
              </span>
              <QRCodeView
                value={createdResult.student.qrToken}
                label={createdResult.studentCode}
                size={136}
                showDownload
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="md"
              icon={<Copy className="w-4 h-4" />}
              onClick={() =>
                copyText(
                  'both',
                  `بيانات دخول مكتبة وثبة الذكية\nالطالب: ${createdResult.fullName}\nكود الطالب: ${createdResult.studentCode}\nرمز الدخول: ${createdResult.plainPin}`
                )
              }
              className="w-full sm:flex-1"
            >
              {copiedKey === 'both' ? 'تم نسخ البطاقة النصية' : 'نسخ كود ورمز الدخول معاً'}
            </Button>
            {createdResult.student && onPrintCard && (
              <Button
                type="button"
                variant="outline"
                size="md"
                icon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  const st = createdResult.student!;
                  onClose();
                  onPrintCard(st);
                }}
                className="w-full sm:w-auto"
              >
                طباعة البطاقة
              </Button>
            )}
            <Button type="button" variant="primary" size="md" onClick={onClose} className="w-full sm:w-auto">
              تم
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">اسم الطالب ثلاثي: *</label>
            <input
              type="text"
              autoFocus
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="مثال: خالد محمد السالم"
              aria-invalid={!!formError}
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

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">اسم المجموعة:</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="مثال: فرسان وثبة"
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>

          {/* كود الطالب ورمز الدخول */}
          <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#dde6ed] space-y-3">
            <span className="text-xs font-black text-[#284d57] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#3b707d]" />
              <span>بيانات تسجيل الدخول المخصصة للطالب</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  كود الطالب (تلقائي أو يدوي): *
                </label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5" />
                    <input
                      type="text"
                      dir="ltr"
                      value={internalId}
                      onChange={(e) => {
                        setInternalId(e.target.value.toUpperCase());
                        if (formError) setFormError(null);
                      }}
                      className="w-full min-h-[42px] pr-8 pl-2 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-black text-left uppercase focus:ring-2 focus:ring-[#3b707d] outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateStudentCode}
                    className="min-w-[40px] min-h-[42px] rounded-xl bg-white border border-slate-300 text-[#3b707d] hover:bg-[#e3ecf3] flex items-center justify-center"
                    title="توليد كود تلقائي"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  رمز الدخول (يُشفر تلقائياً): *
                </label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5" />
                    <input
                      type={showPin ? 'text' : 'password'}
                      dir="ltr"
                      value={customAccessCode}
                      onChange={(e) => {
                        setCustomAccessCode(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full min-h-[42px] pr-8 pl-8 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono font-black text-left tracking-wider focus:ring-2 focus:ring-[#3b707d] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((v) => !v)}
                      className="absolute left-1 top-1 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-[#3b707d]"
                    >
                      {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegeneratePin}
                    className="min-w-[40px] min-h-[42px] rounded-xl bg-white border border-slate-300 text-[#3b707d] hover:bg-[#e3ecf3] flex items-center justify-center"
                    title="توليد رمز دخول عشوائي"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">ملاحظات إضافية (اختياري):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: هوايته قراءة القصص العلمية..."
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {formError}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" size="md" onClick={onClose} type="button" className="w-full sm:w-auto">
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              icon={<CheckCircle className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              تأكيد إضافة الطالب
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
