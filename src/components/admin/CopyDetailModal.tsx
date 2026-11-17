import React, { useState } from 'react';
import { Book, BookCopy, ConditionRating, CopyStatus } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { QRCodeView } from '../qr/QRCodeView';
import {
  formatArabicDate,
  formatArabicDateTime,
  formatUmmAlQuraDate,
  getLoanCountdown,
} from '../../lib/dateUtils';
import {
  User,
  Calendar,
  MapPin,
  ShieldCheck,
  History,
  CheckCircle2,
  Camera,
  Save,
  QrCode,
} from 'lucide-react';

interface CopyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  copy: BookCopy;
  book: Book;
  onSelectStudent?: (studentId: string) => void;
}

export const CopyDetailModal: React.FC<CopyDetailModalProps> = ({
  isOpen,
  onClose,
  copy,
  book,
  onSelectStudent,
}) => {
  const {
    copies,
    loans,
    students,
    staff,
    conditionReports,
    auditLogs,
    loanEvents,
    updateCopy,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveCopy = copies.find((c) => c.id === copy.id) || copy;
  const [editShelf, setEditShelf] = useState(liveCopy.shelfLocation);
  const [editStatus, setEditStatus] = useState<CopyStatus>(liveCopy.status);
  const [editCondition, setEditCondition] = useState<ConditionRating>(liveCopy.condition);
  const [editNotes, setEditNotes] = useState(liveCopy.notes || '');

  const copyLoans = loans
    .filter((l) => l.copyId === liveCopy.id)
    .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime());

  const currentActiveLoan = copyLoans.find(
    (l) => l.status === 'active' || l.status === 'overdue'
  );
  const currentBorrower = currentActiveLoan
    ? students.find((s) => s.id === currentActiveLoan.studentId)
    : undefined;
  const currentSupervisor = currentActiveLoan
    ? staff.find((st) => st.id === currentActiveLoan.supervisorId)
    : undefined;

  const copyReports = conditionReports
    .filter((r) => r.copyId === liveCopy.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const copyLoanIds = new Set(copyLoans.map((l) => l.id));
  const relatedLoanEvents = loanEvents
    .filter((e) => copyLoanIds.has(e.loanId))
    .map((e) => ({
      id: e.id,
      date: e.createdAt,
      title:
        e.eventType === 'checkout'
          ? 'تسليم النسخة لطالب'
          : e.eventType === 'return'
          ? 'استرجاع النسخة'
          : e.eventType,
      actor: staff.find((st) => st.id === e.staffId)?.fullName || 'مشرف المكتبة',
      details: e.notes || '',
    }));

  const relatedAuditLogs = auditLogs
    .filter(
      (a) =>
        a.entityId === liveCopy.id ||
        copyLoanIds.has(a.entityId || '') ||
        (a.notes && a.notes.includes(liveCopy.copyCode))
    )
    .map((a) => ({
      id: a.id,
      date: a.createdAt,
      title: a.action,
      actor: a.actorName,
      details: a.notes || a.reason || '',
    }));

  const allChangesTimeline = [...relatedLoanEvents, ...relatedAuditLogs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleSaveCopyChanges = () => {
    updateCopy({
      ...liveCopy,
      shelfLocation: editShelf.trim() || liveCopy.shelfLocation,
      status: editStatus,
      condition: editCondition,
      notes: editNotes.trim(),
    });
    showToast(`تم حفظ تحديثات النسخة ${liveCopy.copyCode} وتسجيلها بسجل العمليات`, 'success');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`سجل النسخة التفصيلي: ${liveCopy.copyCode}`}
      subtitle={`${book.title} • ${book.author}`}
      maxWidth="4xl"
    >
      <div className="space-y-6 text-xs">
        {/* 1. حالة النسخة الحالية + المستعير الحالي + QR */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {currentBorrower && currentActiveLoan ? (
              <div className="p-5 rounded-3xl bg-gradient-to-l from-blue-900 via-wathba-800 to-wathba-700 text-white shadow-card space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full bg-white/15 text-gold-300 text-[11px] font-black border border-white/20">
                    النسخة مستعارة حالياً لدى الطالب:
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white text-slate-900 font-black text-[11px]">
                    {getLoanCountdown(currentActiveLoan.dueDate).label}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-gold-300" />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectStudent?.(currentBorrower.id)}
                        className="text-lg font-black text-white hover:underline text-right block"
                      >
                        {currentBorrower.fullName}
                      </button>
                      <span className="text-wathba-100 text-xs">
                        {currentBorrower.grade} • {currentBorrower.groupName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/15 text-[11px]">
                  <div>
                    <span className="text-wathba-200 block">تاريخ الاستعارة</span>
                    <strong>{formatUmmAlQuraDate(currentActiveLoan.loanDate)}</strong>
                  </div>
                  <div>
                    <span className="text-wathba-200 block">موعد الإرجاع</span>
                    <strong>{formatUmmAlQuraDate(currentActiveLoan.dueDate)}</strong>
                  </div>
                  <div>
                    <span className="text-wathba-200 block">المشرف المسلم</span>
                    <strong>{currentSupervisor?.fullName || 'مشرف المكتبة'}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-3xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-base font-black text-emerald-950 block">
                      {liveCopy.status === 'available'
                        ? 'متاحة للاستعارة الآن ✅'
                        : `حالة النسخة الحالية:`}
                    </span>
                    <span className="text-emerald-800 text-[11px] block mt-0.5">
                      موقع الرف: <strong>{liveCopy.shelfLocation}</strong> • إجمالي الإعارات السابقة:{' '}
                      <strong>{copyLoans.length}</strong>
                    </span>
                  </div>
                </div>
                <Badge status={liveCopy.status} size="md" />
              </div>
            )}

            {/* Quick Update Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="font-black text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-wathba-600" />
                <span>تحديث بيانات النسخة وحالتها</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">موقع الرف:</label>
                  <input
                    type="text"
                    value={editShelf}
                    onChange={(e) => setEditShelf(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">حالة النسخة:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CopyStatus)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="available">متاحة</option>
                    <option value="reserved">محجوزة</option>
                    <option value="in_preparation">قيد التجهيز</option>
                    <option value="borrowed">مستعارة</option>
                    <option value="overdue">متأخرة</option>
                    <option value="under_inspection">قيد الفحص</option>
                    <option value="damaged">متضررة</option>
                    <option value="lost">مفقودة</option>
                    <option value="maintenance">تحت الصيانة</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">سلامة النسخة:</label>
                  <select
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value as ConditionRating)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="pristine">ممتاز وجديد</option>
                    <option value="good">سليم ونظيف</option>
                    <option value="needs_monitoring">يحتاج متابعة</option>
                    <option value="damaged">متضرر</option>
                    <option value="lost">مفقود</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="ملاحظات المشرف على النسخة..."
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                />
                <Button size="sm" variant="primary" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveCopyChanges}>
                  حفظ التحديث
                </Button>
              </div>
            </div>
          </div>

          {/* QR Code Box */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center shadow-xs">
            <div className="flex items-center gap-1.5 font-black text-slate-800 mb-2">
              <QrCode className="w-4 h-4 text-wathba-600" />
              <span>رمز QR الخاص بالنسخة</span>
            </div>
            <QRCodeView
              value={liveCopy.qrData || liveCopy.copyCode}
              size={150}
              label={liveCopy.copyCode}
              showDownload={true}
            />
            <span className="font-mono text-[10px] text-slate-400 mt-2 break-all">{liveCopy.qrData}</span>
          </div>
        </div>

        {/* 2. سجل جميع المستعيرين (الحالي والسابقين) */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 font-black text-slate-900 flex items-center justify-between">
            <span>سجل جميع الطلاب المستعيرين لهذه النسخة ({copyLoans.length})</span>
            <span className="text-[11px] font-bold text-slate-500">محفوظ تاريخياً بالكامل</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">الطالب</th>
                  <th className="p-3">المجموعة</th>
                  <th className="p-3">المشرف</th>
                  <th className="p-3">تاريخ الاستعارة</th>
                  <th className="p-3">تاريخ الإرجاع الفعلي</th>
                  <th className="p-3">حالة التسليم / الإرجاع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {copyLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      لم تُستعر هذه النسخة من قبل
                    </td>
                  </tr>
                ) : (
                  copyLoans.map((l) => {
                    const stu = students.find((s) => s.id === l.studentId);
                    const sup = staff.find((st) => st.id === l.supervisorId);
                    const checkoutRep = copyReports.find(
                      (r) => r.loanId === l.id && r.stage === 'checkout'
                    );
                    const returnRep = copyReports.find(
                      (r) => r.loanId === l.id && r.stage === 'return'
                    );

                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">
                          {stu ? (
                            <button
                              type="button"
                              onClick={() => onSelectStudent?.(stu.id)}
                              className="text-wathba-700 hover:underline font-black"
                            >
                              {stu.fullName}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 text-slate-600">{stu?.groupName || '-'}</td>
                        <td className="p-3 text-slate-600">{sup?.fullName || '-'}</td>
                        <td className="p-3 text-slate-700">{formatArabicDate(l.loanDate)}</td>
                        <td className="p-3">
                          {l.returnDate ? (
                            <span className="text-emerald-700 font-bold">{formatArabicDate(l.returnDate)}</span>
                          ) : (
                            <span className="text-blue-700 font-bold">مع الطالب حالياً</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {checkoutRep && <Badge status={checkoutRep.rating} label={`تسليم: ${checkoutRep.rating}`} size="sm" />}
                            {returnRep && <Badge status={returnRep.rating} label={`إرجاع: ${returnRep.rating}`} size="sm" />}
                            {!checkoutRep && !returnRep && <span className="text-slate-400">{l.status}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. تقارير الفحص والصور والملاحظات */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="font-black text-slate-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-wathba-600" />
            <span>تقارير الفحص والملاحظات والصور الموثقة ({copyReports.length})</span>
          </div>
          {copyReports.length === 0 ? (
            <p className="text-slate-400 py-4 text-center">لا توجد تقارير فحص مسجلة لهذه النسخة بعد</p>
          ) : (
            <div className="space-y-3">
              {copyReports.map((rep) => {
                const repStaff = staff.find((st) => st.id === rep.staffId);
                return (
                  <div key={rep.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-800">
                          {rep.stage === 'checkout'
                            ? 'فحص التسليم'
                            : rep.stage === 'return'
                            ? 'فحص الإرجاع'
                            : 'فحص الصيانة / الدوري'}
                        </span>
                        <Badge status={rep.rating} size="sm" />
                        <span className="text-slate-500">• المشرف: {repStaff?.fullName || 'مشرف المكتبة'}</span>
                      </div>
                      <span className="text-slate-400 font-mono">{formatArabicDateTime(rep.createdAt)}</span>
                    </div>
                    {rep.details && <p className="text-slate-700">{rep.details}</p>}
                    {rep.photos && rep.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {rep.photos.map((ph, idx) => (
                          <a
                            key={idx}
                            href={ph.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-16 h-16 rounded-xl overflow-hidden border border-slate-300"
                          >
                            <img src={ph.photoUrl} alt={`صورة فحص ${idx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. سجل التغييرات على النسخة */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="font-black text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-wathba-600" />
            <span>جميع التغييرات والأحداث على النسخة ({allChangesTimeline.length})</span>
          </div>
          {allChangesTimeline.length === 0 ? (
            <p className="text-slate-400 py-4 text-center">لا توجد أحداث إضافية مسجلة</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {allChangesTimeline.map((ev, i) => (
                <div key={`${ev.id}-${i}`} className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <strong className="text-slate-900">{ev.title}</strong>
                    <span className="text-slate-500 mr-2">({ev.actor})</span>
                    {ev.details && <span className="block text-slate-600 mt-0.5">{ev.details}</span>}
                  </div>
                  <span className="text-slate-400 font-mono shrink-0">{formatArabicDateTime(ev.date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
