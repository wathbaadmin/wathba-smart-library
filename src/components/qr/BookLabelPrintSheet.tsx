import React, { useState, useEffect } from 'react';
import { BookCopy, Book } from '../../types';
import { generateQRCodeDataUrl } from '../../lib/qrGenerator';
import { Printer, Download } from 'lucide-react';
import { Button } from '../common/Button';

interface BookLabelPrintSheetProps {
  copies: BookCopy[];
  books: Book[];
  onClose?: () => void;
}

export const BookLabelPrintSheet: React.FC<BookLabelPrintSheetProps> = ({ copies, books, onClose }) => {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAllQRs() {
      setLoading(true);
      const map: Record<string, string> = {};
      for (const copy of copies) {
        map[copy.id] = await generateQRCodeDataUrl(copy.qrData || copy.copyCode);
      }
      setQrMap(map);
      setLoading(false);
    }
    if (copies.length > 0) {
      loadAllQRs();
    }
  }, [copies]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex items-center justify-between bg-slate-100 p-3 rounded-xl print:hidden">
        <div>
          <span className="text-xs font-bold text-slate-800">
            ملصقات QR للنسخ الورقية ({copies.length} ملصق)
          </span>
          <p className="text-[11px] text-slate-500">
            جاهزة للطباعة على ورق ملصقات مقاس قياسي (3 أعمدة × 8 صفوف)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
            طباعة الملصقات الآن
          </Button>
          {onClose && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              إغلاق
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">جارٍ توليد ملصقات الـ QR عالية الوضوح...</div>
      ) : (
        /* Printable Label Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white rounded-2xl border border-slate-200 print:border-none print:p-0 print:grid-cols-3">
          {copies.map((copy) => {
            const book = books.find((b) => b.id === copy.bookId);
            const qrImage = qrMap[copy.id];

            return (
              <div
                key={copy.id}
                className="border-2 border-dashed border-slate-300 rounded-xl p-3 flex flex-col items-center justify-between text-center bg-white shadow-xs print:border-solid print:border-slate-800 print:shadow-none break-inside-avoid"
                style={{ minHeight: '170px' }}
              >
                {/* Header */}
                <div className="w-full border-b border-slate-100 pb-1 mb-1">
                  <div className="text-[10px] font-bold text-wathba-800 flex items-center justify-center gap-1">
                    <span>مكتبة وثبة الذكية</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-wathba-600"></span>
                    <span>Wathba</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 truncate max-w-[180px] mx-auto mt-0.5">
                    {book?.title || 'كتاب وثبة'}
                  </div>
                </div>

                {/* QR Code */}
                {qrImage && (
                  <img
                    src={qrImage}
                    alt={copy.copyCode}
                    className="w-20 h-20 object-contain my-1"
                  />
                )}

                {/* Footer details */}
                <div className="w-full border-t border-slate-100 pt-1">
                  <div className="font-mono font-black text-xs text-slate-900 tracking-wider">
                    {copy.copyCode}
                  </div>
                  <div className="text-[9px] text-slate-500 flex justify-between px-1 mt-0.5">
                    <span>الموقع: {copy.shelfLocation}</span>
                    <span>النسخة #{copy.copyCode.split('-').pop()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
