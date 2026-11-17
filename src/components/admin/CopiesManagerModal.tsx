import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Book, BookCopy, ConditionRating } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { QRCodeView } from '../qr/QRCodeView';
import { BookLabelPrintSheet } from '../qr/BookLabelPrintSheet';
import { Plus, Printer, QrCode, MapPin, Edit3, Check, Trash2 } from 'lucide-react';

interface CopiesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
}

export const CopiesManagerModal: React.FC<CopiesManagerModalProps> = ({
  isOpen,
  onClose,
  book,
}) => {
  const { getBookCopies, addCopy, updateCopy } = useLibrary();
  const { showToast } = useNotifications();

  const copies = getBookCopies(book.id);

  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [selectedQRCopy, setSelectedQRCopy] = useState<BookCopy | null>(null);
  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);
  const [editShelf, setEditShelf] = useState('');
  const [editCondition, setEditCondition] = useState<ConditionRating>('good');

  const handleAddNewCopy = () => {
    const newCopy = addCopy(book.id, 'الرف العام');
    showToast(`تمت إضافة النسخة الجديدة ${newCopy.copyCode} بنجاح!`, 'success');
  };

  const handleStartEdit = (copy: BookCopy) => {
    setEditingCopyId(copy.id);
    setEditShelf(copy.shelfLocation);
    setEditCondition(copy.condition);
  };

  const handleSaveEdit = (copy: BookCopy) => {
    updateCopy({
      ...copy,
      shelfLocation: editShelf,
      condition: editCondition,
    });
    setEditingCopyId(null);
    showToast('تم تحديث بيانات النسخة', 'info');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`إدارة النسخ الورقية: ${book.title}`}
      subtitle={`رمز الكتاب: ${book.code} • إجمالي النسخ: ${copies.length}`}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Actions bar */}
        <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div className="text-xs text-slate-600">
            <span>النسخ المتاحة حالياً: </span>
            <strong className="text-emerald-700 font-bold">
              {copies.filter((c) => c.status === 'available').length} من {copies.length}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="royal"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={() => setShowPrintSheet(true)}
            >
              طباعة ملصقات الـ QR للنسخ
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddNewCopy}
            >
              إضافة نسخة جديدة
            </Button>
          </div>
        </div>

        {/* Copies List */}
        <div className="space-y-2.5 max-h-96 overflow-y-auto">
          {copies.map((copy, index) => {
            const isEditing = editingCopyId === copy.id;

            return (
              <div
                key={copy.id}
                className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">
                    {index + 1}
                  </span>
                  <div>
                    <div className="font-mono font-black text-sm text-slate-900">
                      {copy.copyCode}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editShelf}
                          onChange={(e) => setEditShelf(e.target.value)}
                          className="px-2 py-1 rounded border text-xs w-28"
                          placeholder="موقع الرف"
                        />
                        <select
                          value={editCondition}
                          onChange={(e) => setEditCondition(e.target.value as ConditionRating)}
                          className="px-2 py-1 rounded border text-xs"
                        >
                          <option value="pristine">ممتاز</option>
                          <option value="good">سليم</option>
                          <option value="needs_monitoring">متابعة</option>
                          <option value="damaged">متضرر</option>
                        </select>
                      </div>
                    ) : (
                      <div className="text-slate-500 flex items-center gap-2 mt-0.5 text-[11px]">
                        <span>الموقع: <strong>{copy.shelfLocation}</strong></span>
                        <span>•</span>
                        <span>الحالة: {copy.condition}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge status={copy.status} size="sm" />

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
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="تعديل الرف أو الحالة"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedQRCopy(copy)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
                    title="معاينة رمز QR"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Print Sheet Modal */}
        {showPrintSheet && (
          <Modal
            isOpen={showPrintSheet}
            onClose={() => setShowPrintSheet(false)}
            title="طباعة ملصقات QR للكتاب"
            maxWidth="4xl"
          >
            <BookLabelPrintSheet
              copies={copies}
              books={[book]}
              onClose={() => setShowPrintSheet(false)}
            />
          </Modal>
        )}

        {/* Single QR Preview Modal */}
        {selectedQRCopy && (
          <Modal
            isOpen={!!selectedQRCopy}
            onClose={() => setSelectedQRCopy(null)}
            title={`رمز QR: ${selectedQRCopy.copyCode}`}
            maxWidth="sm"
          >
            <div className="flex flex-col items-center justify-center py-4">
              <QRCodeView
                value={selectedQRCopy.qrData || selectedQRCopy.copyCode}
                size={220}
                label={selectedQRCopy.copyCode}
                showDownload={true}
              />
              <span className="text-[11px] text-slate-400 mt-3 text-center">
                ملصق مستقل وخاص بهذه النسخة الورقية من مكتبة وثبة
              </span>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
};
