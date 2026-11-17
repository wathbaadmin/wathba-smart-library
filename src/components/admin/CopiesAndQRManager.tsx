import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { BookCopy, ConditionRating } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { QRCodeView } from '../qr/QRCodeView';
import { BookLabelPrintSheet } from '../qr/BookLabelPrintSheet';
import { QrCode, Search, Filter, Printer, Download, Edit3, Check, Layers, History, Eye } from 'lucide-react';
import { exportToExcel } from '../../lib/exportUtils';
import { InspectionHistoryModal } from '../inspection/InspectionHistoryModal';
import { CopyDetailModal } from './CopyDetailModal';

interface CopiesAndQRManagerProps {
  onOpenStudentReport?: (studentId: string) => void;
}

export const CopiesAndQRManager: React.FC<CopiesAndQRManagerProps> = ({ onOpenStudentReport }) => {
  const { copies, books, conditionReports, updateCopy } = useLibrary();
  const { showToast } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [batchPrintOpen, setBatchPrintOpen] = useState(false);
  const [previewQRCopy, setPreviewQRCopy] = useState<BookCopy | null>(null);
  const [historyCopy, setHistoryCopy] = useState<BookCopy | null>(null);
  const [detailCopy, setDetailCopy] = useState<BookCopy | null>(null);

  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);
  const [editShelf, setEditShelf] = useState('');
  const [editCondition, setEditCondition] = useState<ConditionRating>('good');

  const filteredCopies = copies.filter((copy) => {
    const book = books.find((b) => b.id === copy.bookId);
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      copy.copyCode.toLowerCase().includes(term) ||
      copy.shelfLocation.toLowerCase().includes(term) ||
      (book && book.title.toLowerCase().includes(term));

    const matchBook = selectedBookId === 'all' || copy.bookId === selectedBookId;
    const matchStatus = selectedStatus === 'all' || copy.status === selectedStatus;

    return matchSearch && matchBook && matchStatus;
  });

  const handleStartEdit = (copy: BookCopy) => {
    setEditingCopyId(copy.id);
    setEditShelf(copy.shelfLocation);
    setEditCondition(copy.condition);
  };

  const handleSaveEdit = (copy: BookCopy) => {
    updateCopy({
      ...copy,
      shelfLocation: editShelf.trim() || copy.shelfLocation,
      condition: editCondition,
    });
    setEditingCopyId(null);
    showToast('تم تحديث بيانات النسخة بنجاح', 'success');
  };

  const handleExportExcel = () => {
    const data = filteredCopies.map((c) => {
      const b = books.find((bk) => bk.id === c.bookId);
      return {
        'رمز النسخة': c.copyCode,
        'عنوان الكتاب': b?.title || '-',
        'موقع الرف': c.shelfLocation,
        'حالة النسخة': c.status,
        'تقييم النظافة': c.condition,
        'بيانات الـ QR': c.qrData,
      };
    });
    exportToExcel(data, 'سجل_النسخ_الورقية_والـQR');
    showToast('تم تصدير سجل النسخ إلى Excel بنجاح', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-wathba-100 text-wathba-800">
              <QrCode className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              إدارة النسخ الورقية وملصقات QR
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            متابعة كل نسخة ورقية برمزها الفريد، تحديد مواقع الرفوف، فحص تقارير التلف، وطباعة ملصقات الـ QR المعتمدة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportExcel}
          >
            تصدير Excel
          </Button>
          <Button
            variant="royal"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => setBatchPrintOpen(true)}
          >
            طباعة ملصقات QR المحددة ({filteredCopies.length})
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث برمز النسخة (WTH-125-001) أو عنوان الكتاب أو الرف..."
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-wathba-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">الكتاب:</span>
          <select
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-wathba-500 max-w-[200px]"
          >
            <option value="all">جميع الكتب ({books.length})</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 font-bold shrink-0">الحالة:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
          >
            <option value="all">جميع الحالات</option>
            <option value="available">متاحة</option>
            <option value="borrowed">مستعارة</option>
            <option value="under_inspection">قيد الفحص (رف الإرجاع)</option>
            <option value="damaged">متضررة</option>
            <option value="maintenance">تحت الصيانة</option>
          </select>
        </div>

        <span className="text-[#3b707d] sm:mr-auto font-bold font-mono bg-[#e3ecf3]/60 px-3 py-1.5 rounded-xl">
          {filteredCopies.length} نسخة
        </span>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {filteredCopies.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#e3ecf3] p-10 text-center text-slate-400 text-xs shadow-soft">
            لا توجد نسخ مطابقة لمعايير البحث
          </div>
        ) : (
          filteredCopies.map((copy) => {
            const book = books.find((b) => b.id === copy.bookId);
            const isEditing = editingCopyId === copy.id;
            const reportsCount = conditionReports.filter((r) => r.copyId === copy.id).length;

            return (
              <div
                key={copy.id}
                className="bg-white rounded-2xl border border-[#e3ecf3] p-4 shadow-soft space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono font-black text-[#3b707d] text-xs block">
                      {copy.copyCode}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 truncate">
                      {book?.title || 'كتاب وثبة'}
                    </h4>
                  </div>
                  <Badge status={copy.status} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-[#f6f8fa] p-3 rounded-xl border border-[#e3ecf3]/70">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">موقع الرف</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editShelf}
                        onChange={(e) => setEditShelf(e.target.value)}
                        className="w-full min-h-[38px] px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    ) : (
                      <span className="font-bold text-slate-700">{copy.shelfLocation}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">سلامة الكتاب</span>
                    {isEditing ? (
                      <select
                        value={editCondition}
                        onChange={(e) => setEditCondition(e.target.value as ConditionRating)}
                        className="w-full min-h-[38px] px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                      >
                        <option value="pristine">ممتاز وجديد</option>
                        <option value="good">سليم ونظيف</option>
                        <option value="needs_monitoring">يحتاج متابعة</option>
                        <option value="damaged">متضرر</option>
                      </select>
                    ) : (
                      <Badge status={copy.condition} size="sm" />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  {isEditing ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => handleSaveEdit(copy)}
                      className="flex-1"
                    >
                      حفظ التعديلات
                    </Button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(copy)}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDetailCopy(copy)}
                    className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#e3ecf3]/70 hover:bg-[#e3ecf3] text-[#284d57] text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>السجل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewQRCopy(copy)}
                    className="min-h-[40px] px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR</span>
                  </button>

                  {reportsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setHistoryCopy(copy)}
                      className="min-h-[40px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>({reportsCount})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Copies Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#e3ecf3] overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#f6f8fa] text-slate-700 font-bold border-b border-[#e3ecf3]">
              <tr>
                <th className="p-4">رمز النسخة</th>
                <th className="p-4">عنوان الكتاب</th>
                <th className="p-4">موقع الرف</th>
                <th className="p-4">حالة النسخة</th>
                <th className="p-4">سلامة الكتاب</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCopies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    لا توجد نسخ مطابقة لمعايير البحث
                  </td>
                </tr>
              ) : (
                filteredCopies.map((copy) => {
                  const book = books.find((b) => b.id === copy.bookId);
                  const isEditing = editingCopyId === copy.id;
                  const reportsCount = conditionReports.filter((r) => r.copyId === copy.id).length;

                  return (
                    <tr key={copy.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                      <td className="p-4 font-mono font-black text-slate-900 text-sm">
                        {copy.copyCode}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {book?.title || 'كتاب وثبة'}
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editShelf}
                            onChange={(e) => setEditShelf(e.target.value)}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs w-28"
                          />
                        ) : (
                          <span className="font-medium text-slate-600">{copy.shelfLocation}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge status={copy.status} size="sm" />
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <select
                            value={editCondition}
                            onChange={(e) => setEditCondition(e.target.value as ConditionRating)}
                            className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold"
                          >
                            <option value="pristine">ممتاز وجديد</option>
                            <option value="good">سليم ونظيف</option>
                            <option value="needs_monitoring">يحتاج متابعة</option>
                            <option value="damaged">متضرر</option>
                          </select>
                        ) : (
                          <Badge status={copy.condition} size="sm" />
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEditing ? (
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Check className="w-3.5 h-3.5" />}
                              onClick={() => handleSaveEdit(copy)}
                            >
                              حفظ
                            </Button>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(copy)}
                              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="تعديل الرف أو الحالة"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setDetailCopy(copy)}
                            className="p-2 rounded-lg text-slate-400 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60"
                            title="سجل النسخة التفصيلي والمستعيرين"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setPreviewQRCopy(copy)}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
                            title="عرض ملصق QR"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>

                          {reportsCount > 0 && (
                            <button
                              onClick={() => setHistoryCopy(copy)}
                              className="p-2 rounded-lg text-slate-400 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60"
                              title={`سجل الفحص (${reportsCount})`}
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
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

      {/* Batch Print Labels Modal */}
      {batchPrintOpen && (
        <Modal
          isOpen={batchPrintOpen}
          onClose={() => setBatchPrintOpen(false)}
          title="طباعة ملصقات QR للنسخ المحددة"
          maxWidth="4xl"
        >
          <BookLabelPrintSheet
            copies={filteredCopies}
            books={books}
            onClose={() => setBatchPrintOpen(false)}
          />
        </Modal>
      )}

      {/* Single QR Preview Modal */}
      {previewQRCopy && (
        <Modal
          isOpen={!!previewQRCopy}
          onClose={() => setPreviewQRCopy(null)}
          title={`ملصق QR للنسخة: ${previewQRCopy.copyCode}`}
          maxWidth="sm"
        >
          <div className="flex flex-col items-center justify-center py-4">
            <QRCodeView
              value={previewQRCopy.qrData || previewQRCopy.copyCode}
              size={220}
              label={previewQRCopy.copyCode}
              showDownload={true}
            />
            <span className="text-[11px] text-slate-400 mt-3 text-center">
              ملصق معتمد لنسخة كتاب من مكتبة وثبة الذكية
            </span>
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

      {/* Full Copy Detail Dossier Modal */}
      {detailCopy && books.find((b) => b.id === detailCopy.bookId) && (
        <CopyDetailModal
          isOpen={!!detailCopy}
          onClose={() => setDetailCopy(null)}
          copy={detailCopy}
          book={books.find((b) => b.id === detailCopy.bookId)!}
          onSelectStudent={(stuId) => {
            setDetailCopy(null);
            onOpenStudentReport?.(stuId);
          }}
        />
      )}
    </div>
  );
};
