import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Book, Category, Student } from '../../types';
import { BookOpen, BookMarked, CheckCircle2, AlertCircle } from 'lucide-react';

interface BookDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  category?: Category;
  student?: Student | null;
  onReserve?: (bookId: string) => void;
  isReservedByStudent?: boolean;
  isEligibleToReserve?: boolean;
  eligibilityReason?: string;
}

export const BookDetailsModal: React.FC<BookDetailsModalProps> = ({
  isOpen,
  onClose,
  book,
  student,
  onReserve,
  isReservedByStudent = false,
  isEligibleToReserve = true,
  eligibilityReason,
}) => {
  const hasAvailable = book.availableCopiesCount > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={book.title}
      subtitle={`رمز الكتاب: ${book.code}`}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Book Header Card */}
        <div className="rounded-3xl bg-gradient-to-l from-[#3b707d] to-[#284d57] p-6 text-white text-center shadow-soft relative overflow-hidden">
          {book.coverImageUrl ? (
            <div className="w-24 h-32 rounded-2xl bg-white p-1.5 mx-auto mb-3 shadow-card overflow-hidden flex items-center justify-center">
              <img
                src={book.coverImageUrl}
                alt={book.title}
                loading="lazy"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-3 text-[#e3ecf3] shadow-soft">
              <BookOpen className="w-7 h-7" />
            </div>
          )}
          <h2 className="text-xl font-black text-white leading-snug">{book.title}</h2>
          <span className="inline-block mt-2 font-mono text-xs text-[#e3ecf3] bg-white/15 px-3 py-1 rounded-lg border border-white/15">
            {book.code}
          </span>
        </div>

        {/* Copies Counter & Status */}
        <div className="p-4 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] flex items-center justify-between gap-3">
          <div className="text-right">
            <span className="text-slate-500 block text-xs">النسخ الورقية المتاحة:</span>
            <span className="font-bold text-slate-800 text-sm">
              {book.availableCopiesCount} من أصل {book.totalCopiesCount} نسخ
            </span>
          </div>
          <Badge
            status={hasAvailable ? 'available' : 'borrowed'}
            label={hasAvailable ? 'متوفر للإعارة' : 'جميع النسخ معارة'}
          />
        </div>

        {/* Eligibility warnings if any */}
        {!isEligibleToReserve && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{eligibilityReason || 'لا يمكنك استعارة أو حجز المزيد من الكتب حالياً'}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
          <Button variant="secondary" size="md" onClick={onClose} className="w-full sm:w-auto">
            إغلاق
          </Button>

          {hasAvailable && onReserve ? (
            <Button
              variant="primary"
              size="md"
              disabled={isReservedByStudent || !isEligibleToReserve}
              onClick={() => {
                onReserve(book.id);
                onClose();
              }}
              icon={<BookMarked className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold px-6"
            >
              {isReservedByStudent ? 'الكتاب محجوز لك بالفعل' : 'حجز الكتاب الآن'}
            </Button>
          ) : hasAvailable ? null : (
            <span className="text-xs text-slate-400 font-bold px-3 py-2 text-center">
              الكتاب غير متاح حالياً
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};
