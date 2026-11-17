import React, { useState, useEffect } from 'react';
import { Student } from '../../types';
import { generateQRCodeDataUrl } from '../../lib/qrGenerator';
import { useLibrary } from '../../context/LibraryContext';
import { Printer, Download, Ban, AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button';
import { MidadLogo } from '../common/MidadLogo';

interface StudentCardPrintSheetProps {
  students: Student[];
  onClose?: () => void;
}

export const StudentCardPrintSheet: React.FC<StudentCardPrintSheetProps> = ({ students, onClose }) => {
  const { issuedStudentCredentials, settings } = useLibrary();
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAllStudentQRs() {
      setLoading(true);
      const map: Record<string, string> = {};
      for (const student of students) {
        map[student.id] = await generateQRCodeDataUrl(student.qrToken);
      }
      setQrMap(map);
      setLoading(false);
    }
    if (students.length > 0) {
      loadAllStudentQRs();
    } else {
      setQrMap({});
      setLoading(false);
    }
  }, [students]);

  const handleDownloadQr = (student: Student, dataUrl?: string) => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${student.internalId}_${student.fullName.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl print:hidden">
        <div>
          <span className="text-xs font-bold text-slate-800">
            بطاقات عضوية الطلاب ({students.length} بطاقة)
          </span>
          <p className="text-[11px] text-slate-500">
            تحتوي على QR الآمن والرمز التعريفي ورمز الدخول الخاص بالطالب
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
            طباعة البطاقات
          </Button>
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              إغلاق
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">جارٍ إعداد بطاقات الطلاب والرموز المشفرة...</div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white rounded-2xl border border-slate-200 print:border-none print:p-0 print:grid-cols-2">
          {students.map((student) => {
            const qrImage = qrMap[student.id];

            return (
              <div
                key={student.id}
                className="rounded-2xl border-2 border-emerald-600/30 overflow-hidden bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 p-4 shadow-sm relative flex flex-col justify-between print:shadow-none print:border-emerald-700 break-inside-avoid"
                style={{ minHeight: '220px' }}
              >
                {/* Header with Midad Logo */}
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-[#1b3247] flex items-center justify-center p-0.5 shadow-xs">
                      <MidadLogo variant="icon" theme="dark" size="xs" className="h-7 w-auto" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 leading-tight">
                        {settings.libraryName || 'مكتبة مداد الذكية'}
                      </div>
                      <div className="text-[9px] text-[#284d57] font-semibold">بطاقة قارئ معتمد • 2026</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    {student.internalId}
                  </span>
                </div>

                {/* Body: Student details & QR */}
                <div className="flex items-center justify-between gap-4 my-2">
                  <div className="space-y-1 text-right flex-1">
                    <div className="text-sm font-black text-slate-900">{student.fullName}</div>
                    <div className="text-[11px] text-slate-600">
                      <span>الصف: <strong>{student.grade}</strong></span>
                      <span className="mx-1">•</span>
                      <span>{student.stage}</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 font-medium">
                      المجموعة: <strong>{student.groupName}</strong>
                    </div>

                    <div className="mt-3 p-2 bg-emerald-100/70 rounded-xl border border-emerald-200">
                      <div className="text-[9px] text-emerald-900 font-bold">رمز الدخول للمنصة:</div>
                      <div className="font-mono text-xs sm:text-sm font-black text-emerald-900 tracking-wider mt-0.5">
                        {issuedStudentCredentials[student.id]?.plainAccessCode || 'مشفّر وآمن (أعد التعيين لطباعته)'}
                      </div>
                    </div>
                  </div>

                  {/* QR Image */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="p-1.5 bg-white rounded-xl shadow-sm border border-slate-200 relative">
                      {qrImage && (
                        <img
                          src={qrImage}
                          alt={student.fullName}
                          className={`w-24 h-24 object-contain ${
                            student.qrTokenStatus === 'revoked' || student.qrLoginEnabled === false
                              ? 'opacity-40'
                              : ''
                          }`}
                        />
                      )}
                    </div>
                    {student.qrTokenStatus === 'revoked' ? (
                      <span className="text-[9px] text-rose-600 mt-1 font-bold flex items-center gap-0.5">
                        <Ban className="w-2.5 h-2.5" /> ملغى
                      </span>
                    ) : student.qrLoginEnabled === false ? (
                      <span className="text-[9px] text-amber-600 mt-1 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> معطّل للدخول
                      </span>
                    ) : (
                      <span className="text-[8px] text-slate-400 mt-1 font-mono">باركود دخول ذكي</span>
                    )}
                    {qrImage && student.qrTokenStatus !== 'revoked' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadQr(student, qrImage)}
                        className="mt-1 text-[10px] font-bold text-[#3b707d] hover:underline inline-flex items-center gap-0.5 print:hidden"
                      >
                        <Download className="w-3 h-3" />
                        <span>تنزيل PNG</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer instructions */}
                <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-1.5 flex justify-between">
                  <span>احرص على إبراز هذه البطاقة عند استعارة الكتب</span>
                  <span>فريق وثبة التربوي</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
