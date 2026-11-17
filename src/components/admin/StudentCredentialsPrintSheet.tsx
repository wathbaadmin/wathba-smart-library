import React, { useState, useEffect } from 'react';
import { EphemeralStudentCredential, Student } from '../../types';
import { generateQRCodeDataUrl } from '../../lib/qrGenerator';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../common/Button';
import { Printer, Copy, Check, KeyRound, Hash, ShieldCheck } from 'lucide-react';

interface StudentCredentialsPrintSheetProps {
  students: Student[];
  credentialsMap?: Record<string, EphemeralStudentCredential>;
  onClose?: () => void;
}

export const StudentCredentialsPrintSheet: React.FC<StudentCredentialsPrintSheetProps> = ({
  students,
  credentialsMap = {},
  onClose,
}) => {
  const { showToast } = useNotifications();
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function gen() {
      const map: Record<string, string> = {};
      for (const s of students) {
        map[s.id] = await generateQRCodeDataUrl(s.qrToken);
      }
      if (active) setQrMap(map);
    }
    if (students.length > 0) gen();
    return () => {
      active = false;
    };
  }, [students]);

  const copyLine = async (student: Student) => {
    const cred = credentialsMap[student.id];
    const text = cred
      ? `الطالب: ${student.fullName}\nكود الطالب: ${cred.studentCode}\nرمز الدخول: ${cred.plainAccessCode}`
      : `الطالب: ${student.fullName}\nكود الطالب: ${student.internalId}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(student.id);
      showToast(`تم نسخ بيانات ${student.fullName}`, 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('تعذر النسخ التلقائي للحافظة', 'warning');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f6f8fa] border border-[#dde6ed] p-3.5 rounded-2xl print:hidden">
        <div>
          <span className="text-xs font-black text-slate-900 block">
            بطاقات وكشف بيانات دخول الطلاب ({students.length} طالب)
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">
            مجهّزة للطباعة أو التسليم الفردي — تظهر رموز الدخول المولدة حديثاً فقط حرصاً على أمان البيانات.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()}
          >
            طباعة الكشف
          </Button>
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              إغلاق
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-2">
        {students.map((student) => {
          const cred = credentialsMap[student.id];
          const qr = qrMap[student.id];
          return (
            <div
              key={student.id}
              className="rounded-2xl border-2 border-[#3b707d]/30 bg-white p-4 space-y-3 shadow-soft print:shadow-none break-inside-avoid"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <span className="text-[10px] font-black text-[#3b707d] block">
                    مكتبة وثبة الذكية • بيانات الدخول
                  </span>
                  <h4 className="font-black text-sm text-slate-900 mt-0.5">{student.fullName}</h4>
                  <span className="text-[11px] text-slate-500">
                    {student.grade} • {student.groupName}
                  </span>
                </div>
                {qr && (
                  <img
                    src={qr}
                    alt={student.fullName}
                    className="w-16 h-16 rounded-lg border border-slate-200 p-0.5 shrink-0 object-contain"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-[#f6f8fa] border border-[#dde6ed]">
                  <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <Hash className="w-3 h-3 text-[#3b707d]" />
                    كود الطالب:
                  </span>
                  <div className="font-mono font-black text-sm text-[#284d57] mt-1" dir="ltr">
                    {cred?.studentCode || student.internalId}
                  </div>
                </div>

                <div
                  className={`p-2.5 rounded-xl border ${
                    cred?.plainAccessCode
                      ? 'bg-[#e3ecf3]/75 border-[#3b707d]/30'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-[#3b707d]" />
                    رمز الدخول:
                  </span>
                  {cred?.plainAccessCode ? (
                    <div
                      className="font-mono font-black text-sm text-slate-900 tracking-widest mt-1"
                      dir="ltr"
                    >
                      {cred.plainAccessCode}
                    </div>
                  ) : (
                    <div className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>مشفّر (أعد التعيين لإصدار رمز جديد)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                <span>الحساب: {student.status === 'active' ? 'مفعّل' : 'موقوف'}</span>
                <button
                  type="button"
                  onClick={() => copyLine(student)}
                  className="print:hidden inline-flex items-center gap-1 text-[#3b707d] hover:underline font-bold"
                >
                  {copiedId === student.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>نسخ البيانات</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
