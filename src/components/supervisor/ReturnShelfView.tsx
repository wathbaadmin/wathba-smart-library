import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { BookCopy, ConditionRating } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { InspectionHistoryModal } from '../inspection/InspectionHistoryModal';
import { BookOpen, CheckCircle, Wrench, AlertTriangle, History, ArrowRight, MapPin } from 'lucide-react';
import { formatArabicDateTime } from '../../lib/dateUtils';

export const ReturnShelfView: React.FC = () => {
  const { copies, books, conditionReports, approveReturnInspection, updateCopy } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  // النسخ الموجودة حالياً على رف الإرجاع (قيد الفحص)
  const returnShelfCopies = copies.filter((c) => c.status === 'under_inspection');

  const [inspectingCopy, setInspectingCopy] = useState<BookCopy | null>(null);
  const [targetShelf, setTargetShelf] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<ConditionRating>('good');
  const [historyCopy, setHistoryCopy] = useState<BookCopy | null>(null);

  const handleOpenApproveModal = (copy: BookCopy) => {
    setInspectingCopy(copy);
    setTargetShelf(copy.shelfLocation || 'رف أ-1');
    setSelectedCondition(copy.condition || 'good');
  };

  const handleConfirmApproval = () => {
    if (!inspectingCopy || !currentStaff) return;

    approveReturnInspection(
      inspectingCopy.id,
      selectedCondition,
      targetShelf,
      currentStaff.id
    );

    showToast(`تم اعتماد النسخة ${inspectingCopy.copyCode} ونقلها إلى ${targetShelf} بنجاح!`, 'success');
    setInspectingCopy(null);
  };

  const handleSendToMaintenance = (copy: BookCopy) => {
    updateCopy({
      ...copy,
      status: 'maintenance',
      notes: 'تحت التجليد والصيانة لسلامة الكتاب',
    });
    showToast(`تم تحويل النسخة ${copy.copyCode} إلى ورشة الصيانة والتغليف`, 'info');
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-100 text-orange-800">
              <BookOpen className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">رف الإرجاع وفحص الكتب المستلمة</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            محطة الحماية الإلزامية: هنا تستقر الكتب المسترجعة من الطلاب لحين التأكد التام من سلامة الأوراق والغلاف ونظافتها قبل إتاحتها للحجز والإعارة من جديد.
          </p>
        </div>

        <div className="px-5 py-3 rounded-2xl bg-orange-50 border border-orange-200 text-center shrink-0">
          <span className="block text-2xl font-black text-orange-800">
            {returnShelfCopies.length}
          </span>
          <span className="text-[11px] font-bold text-orange-700">نسخ تنتظر الفحص</span>
        </div>
      </div>

      {/* Copies Grid */}
      {returnShelfCopies.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <h4 className="font-bold text-base text-slate-800">رف الإرجاع فارغ تماماً ومُنظم!</h4>
          <p className="text-xs text-slate-400 mt-1">
            جميع الكتب المعادة تم فحصها وتسكينها على الرفوف النشطة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {returnShelfCopies.map((copy) => {
            const book = books.find((b) => b.id === copy.bookId);
            const copyReports = conditionReports.filter((r) => r.copyId === copy.id);
            const latestReport = copyReports[copyReports.length - 1];

            return (
              <div
                key={copy.id}
                className="p-5 rounded-2xl bg-white border border-orange-200 shadow-soft flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-20 rounded-xl bg-gradient-to-tr from-wathba-800 to-emerald-600 text-gold-300 flex items-center justify-center shadow-xs shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 text-right flex-1">
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {book?.title}
                    </h4>
                    <span className="font-mono text-xs font-bold text-slate-700 block">
                      {copy.copyCode}
                    </span>
                    <div className="mt-1">
                      <Badge status={copy.condition} size="sm" />
                    </div>
                  </div>
                </div>

                {latestReport && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    <span className="text-[10px] text-slate-400 block">آخر ملاحظة مسجلة:</span>
                    <p className="line-clamp-2 mt-0.5">{latestReport.details}</p>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setHistoryCopy(copy)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium"
                  >
                    <History className="w-3.5 h-3.5" />
                    السجل التاريخي ({copyReports.length})
                  </button>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="تحويل لورشة الصيانة"
                      icon={<Wrench className="w-3.5 h-3.5 text-slate-600" />}
                      onClick={() => handleSendToMaintenance(copy)}
                    >
                      صيانة
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<CheckCircle className="w-3.5 h-3.5" />}
                      onClick={() => handleOpenApproveModal(copy)}
                    >
                      اعتماد ونقل للرف
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approval Modal */}
      {inspectingCopy && (
        <Modal
          isOpen={!!inspectingCopy}
          onClose={() => setInspectingCopy(null)}
          title="اعتماد فحص النسخة وإعادتها للرف"
          subtitle={`النسخة: ${inspectingCopy.copyCode}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تأكيد حالة النسخة النهائية:
              </label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value as ConditionRating)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-wathba-500 font-bold"
              >
                <option value="pristine">✨ ممتاز وجديد تماماً</option>
                <option value="good">👍 سليم ونظيف (جاهز للإعارة)</option>
                <option value="needs_monitoring">⚠️ يحتاج متابعة وتغليف قريب</option>
                <option value="damaged">❌ متضرر (لا يصلح للإعارة)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تسكين النسخة في الرف:
              </label>
              <input
                type="text"
                value={targetShelf}
                onChange={(e) => setTargetShelf(e.target.value)}
                placeholder="مثال: رف أ-1، رف القصص الإسلامية 2..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-wathba-500 font-bold"
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
              عند الضغط على تأكيد الاعتماد، ستصبح النسخة متاحة فوراً في فهرس الطلاب للحجز والإعارة.
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="md" onClick={() => setInspectingCopy(null)}>
                إلغاء
              </Button>
              <Button variant="primary" size="md" onClick={handleConfirmApproval}>
                تأكيد وإتاحة في المكتبة
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* History Inspection Modal */}
      {historyCopy && (
        <InspectionHistoryModal
          isOpen={!!historyCopy}
          onClose={() => setHistoryCopy(null)}
          copy={historyCopy}
          book={books.find((b) => b.id === historyCopy.bookId)}
          reports={conditionReports.filter((r) => r.copyId === historyCopy.id)}
        />
      )}
    </div>
  );
};
