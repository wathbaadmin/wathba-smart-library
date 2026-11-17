import React, { useState, useEffect } from 'react';
import { Student } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { generateQRCodeDataUrl } from '../../lib/qrGenerator';
import { formatArabicDateTime } from '../../lib/dateUtils';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  Download,
  Printer,
  RefreshCw,
  Ban,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Power,
} from 'lucide-react';

interface StudentQrModalProps {
  isOpen: boolean;
  student: Student | null;
  onClose: () => void;
  onPrintSingleCard: (student: Student) => void;
}

export const StudentQrModal: React.FC<StudentQrModalProps> = ({
  isOpen,
  student,
  onClose,
  onPrintSingleCard,
}) => {
  const { currentStaff } = useAuth();
  const {
    students,
    reissueStudentQrToken,
    revokeStudentQrToken,
    toggleStudentQrLogin,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveStudent = student
    ? students.find((s) => s.id === student.id) || student
    : null;

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<'reissue' | 'revoke' | null>(null);

  useEffect(() => {
    setConfirmAction(null);
  }, [isOpen, liveStudent?.id]);

  useEffect(() => {
    let active = true;
    if (isOpen && liveStudent?.qrToken) {
      generateQRCodeDataUrl(liveStudent.qrToken).then((url) => {
        if (active) setQrDataUrl(url);
      });
    } else {
      setQrDataUrl('');
    }
    return () => {
      active = false;
    };
  }, [isOpen, liveStudent?.qrToken]);

  if (!isOpen || !liveStudent) return null;

  const isRevoked = liveStudent.qrTokenStatus === 'revoked';
  const isQrEnabled = liveStudent.qrLoginEnabled !== false && !isRevoked;

  const handleDownloadImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${liveStudent.internalId}_${liveStudent.fullName.replace(/\s+/g, '_')}.png`;
    a.click();
    showToast(`تم تنزيل صورة الباركود للطالب ${liveStudent.fullName}`, 'success');
  };

  const handleToggleQr = () => {
    const nextEnabled = !isQrEnabled;
    const res = toggleStudentQrLogin({
      studentId: liveStudent.id,
      enabled: nextEnabled,
      staffId: currentStaff?.id,
    });
    if (res.success) {
      showToast(
        nextEnabled
          ? `تم تفعيل الدخول بالباركود للطالب ${liveStudent.fullName}`
          : `تم تعطيل الدخول بالباركود للطالب ${liveStudent.fullName}`,
        nextEnabled ? 'success' : 'warning'
      );
    }
  };

  const handleConfirmReissue = () => {
    const res = reissueStudentQrToken({
      studentId: liveStudent.id,
      staffId: currentStaff?.id,
      reason: 'إعادة إصدار من لوحة الإدارة وإبطال البطاقة السابقة',
    });
    setConfirmAction(null);
    if (res.success) {
      showToast(
        `تم إصدار باركود جديد للطالب ${liveStudent.fullName} وإبطال الباركود القديم نهائياً`,
        'success'
      );
    }
  };

  const handleConfirmRevoke = () => {
    const res = revokeStudentQrToken({
      studentId: liveStudent.id,
      staffId: currentStaff?.id,
      reason: 'إلغاء البطاقة من لوحة الإدارة',
    });
    setConfirmAction(null);
    if (res.success) {
      showToast(
        `تم إلغاء باركود الطالب ${liveStudent.fullName} ولا يمكن الدخول به بعد الآن`,
        'warning'
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`باركود دخول الطالب: ${liveStudent.fullName}`}
      subtitle={`${liveStudent.internalId} • ${liveStudent.grade} • ${liveStudent.groupName}`}
      maxWidth="md"
    >
      <div className="space-y-4 text-right font-arabic" dir="rtl">
        {/* شريط الحالة الأمنية */}
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
            isRevoked
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : !isQrEnabled
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-black">
            {isRevoked ? (
              <Ban className="w-4 h-4 text-rose-600 shrink-0" />
            ) : !isQrEnabled ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>
              {isRevoked
                ? 'الباركود الحالي ملغى (غير صالح للدخول)'
                : !isQrEnabled
                ? 'الدخول بالباركود معطّل مؤقتاً لهذا الطالب'
                : 'الباركود مفعّل وصالح لتسجيل الدخول'}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white/80 border border-black/10">
            الإصدار #{liveStudent.qrTokenVersion || 1}
          </span>
        </div>

        {/* معاينة QR */}
        <div className="p-5 rounded-3xl bg-[#f4f7f9] border border-[#dde6ed] flex flex-col items-center justify-center gap-3">
          <div
            className={`p-3 bg-white rounded-2xl border-2 shadow-sm relative ${
              isRevoked || !isQrEnabled ? 'border-rose-300 opacity-60' : 'border-[#3b707d]/30'
            }`}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR ${liveStudent.fullName}`}
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                جارٍ توليد الرمز...
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <div className="text-xs font-black text-[#1c353d]">{liveStudent.fullName}</div>
            <div className="text-[11px] font-mono text-slate-500" dir="ltr">
              {liveStudent.internalId}
            </div>
            {liveStudent.qrTokenIssuedAt && (
              <div className="text-[10px] text-slate-400">
                تاريخ الإصدار: {formatArabicDateTime(liveStudent.qrTokenIssuedAt)}
              </div>
            )}
          </div>
        </div>

        {/* إجراءات العرض والتنزيل والطباعة */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadImage}
            disabled={!qrDataUrl || isRevoked}
          >
            تنزيل صورة QR
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => {
              onClose();
              onPrintSingleCard(liveStudent);
            }}
            disabled={isRevoked}
          >
            طباعة بطاقة الطالب
          </Button>
        </div>

        {/* تأكيد الإجراءات الحساسة */}
        {confirmAction === 'reissue' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-3">
            <div className="text-xs font-bold text-amber-950 leading-relaxed">
              هل تريد إصدار باركود جديد لهذا الطالب؟ سيتم <strong>إبطال الباركود القديم نهائياً</strong> ولن يتمكن أي شخص يحمل البطاقة السابقة من الدخول بها.
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={handleConfirmReissue}
              >
                نعم، إصدار باركود جديد
              </Button>
            </div>
          </div>
        )}

        {confirmAction === 'revoke' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 space-y-3">
            <div className="text-xs font-bold text-rose-950 leading-relaxed">
              سيتم إلغاء الباركود الحالي فوراً وإيقاف الدخول عبر QR لهذا الطالب (مع بقاء الدخول اليدوي بالكود ورمز الدخول متاحاً إذا كان الحساب نشطاً).
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={<Ban className="w-3.5 h-3.5" />}
                onClick={handleConfirmRevoke}
              >
                تأكيد إلغاء الباركود
              </Button>
            </div>
          </div>
        )}

        {/* أزرار الحماية وإعادة الإصدار */}
        {!confirmAction && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<Power className="w-3.5 h-3.5" />}
                onClick={handleToggleQr}
              >
                {isQrEnabled ? 'تعطيل QR مؤقتاً' : 'تفعيل QR'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => setConfirmAction('reissue')}
              >
                إعادة إصدار QR
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={<Ban className="w-3.5 h-3.5" />}
                onClick={() => setConfirmAction('revoke')}
                disabled={isRevoked}
              >
                إلغاء الباركود
              </Button>
            </div>
          </div>
        )}

        {/* توضيح الأمان */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#3b707d] shrink-0 mt-0.5" />
          <span>
            للحماية القصوى: لا يحتوي هذا الباركود على رمز الدخول السري أو أي بيانات شخصية حساسة، بل يعتمد على رمز عشوائي فريد مشفّر.
          </span>
        </div>
      </div>
    </Modal>
  );
};
