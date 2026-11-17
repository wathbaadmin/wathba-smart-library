import React, { useState } from 'react';
import { Book, Category } from '../../types';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { BookOpen, BookMarked, Eye, User } from 'lucide-react';

interface StudentBookCardProps {
  book: Book;
  category?: Category;
  onViewDetails: (book: Book) => void;
  onReserve: (bookId: string) => void;
  isReserved?: boolean;
  isEligible?: boolean;
}

export const StudentBookCard: React.FC<StudentBookCardProps> = ({
  book,
  category,
  onViewDetails,
  onReserve,
  isReserved = false,
  isEligible = true,
}) => {
  const [imgError, setImgError] = useState(false);
  const isAvailable = book.availableCopiesCount > 0;
  const hasValidCover = Boolean(book.coverImageUrl?.trim()) && !imgError;

  return (
    <article className="h-full rounded-3xl bg-white border border-slate-200/90 overflow-hidden shadow-soft hover:shadow-card hover:border-[#3b707d]/50 transition-all duration-150 flex flex-col justify-between text-right">
      {/* 1. غلاف الكتاب بدون قص أو تشويه */}
      <button
        type="button"
        onClick={() => onViewDetails(book)}
        className="relative w-full aspect-[4/3] bg-[#e3ecf3]/55 border-b border-slate-100 flex items-center justify-center overflow-hidden group text-right focus-visible:outline-none"
      >
        {hasValidCover ? (
          <img
            src={book.coverImageUrl}
            alt={book.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#3b707d] to-[#27434b] p-4 flex flex-col justify-between text-white">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold bg-white/15 px-2 py-0.5 rounded-md">
                {book.code}
              </span>
              {category && (
                <span className="text-[10px] font-bold bg-white/15 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                  {category.name}
                </span>
              )}
            </div>
            <div className="my-auto text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center mx-auto">
                <BookOpen className="w-5 h-5 text-[#e3ecf3]" />
              </div>
              <span className="block font-black text-sm leading-snug line-clamp-2 px-1">
                {book.title}
              </span>
            </div>
            <div className="text-[10px] text-[#e3ecf3] flex items-center justify-between border-t border-white/15 pt-1.5">
              <span>{book.pageCount ? `${book.pageCount} صفحة` : 'مكتبة وثبة'}</span>
              <span>{book.totalCopiesCount} نسخة</span>
            </div>
          </div>
        )}

        {/* Status badge top-left */}
        <div className="absolute top-2.5 left-2.5">
          <Badge
            status={isAvailable ? 'available' : 'borrowed'}
            label={isAvailable ? `متاح (${book.availableCopiesCount})` : 'مستعار حالياً'}
          />
        </div>
      </button>

      {/* 2. تفاصيل الكتاب المتناسقة */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            {category && (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#e3ecf3]/75 text-[#27434b] truncate">
                {category.name}
              </span>
            )}
            <span className="font-mono text-[10px] text-slate-400 shrink-0">{book.code}</span>
          </div>

          <h4 className="font-black text-sm text-slate-900 line-clamp-2 min-h-[2.5rem] leading-snug">
            {book.title}
          </h4>

          <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{book.author || 'إصدار مكتبة وثبة'}</span>
          </p>
        </div>

        {/* 3. أزرار واضحة متباعدة بمساحة لمس مريحة */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onViewDetails(book)}
            icon={<Eye className="w-3.5 h-3.5" />}
            className="w-full"
          >
            التفاصيل
          </Button>

          {isAvailable ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={isReserved || !isEligible}
              onClick={() => onReserve(book.id)}
              icon={<BookMarked className="w-3.5 h-3.5" />}
              className="w-full"
            >
              {isReserved ? 'محجوز لك' : 'حجز'}
            </Button>
          ) : (
            <span className="min-h-[40px] flex items-center justify-center text-[11px] font-bold text-slate-500 bg-slate-100 rounded-xl px-2 text-center">
              غير متاح
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
