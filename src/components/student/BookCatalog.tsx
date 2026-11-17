import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Book, Category } from '../../types';
import { BookDetailsModal } from './BookDetailsModal';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Search, Filter, Sparkles, BookOpen, Layers, CheckCircle2 } from 'lucide-react';

export const BookCatalog: React.FC = () => {
  const { books, categories, requestReservation, reservations, isStudentEligibleForLoan } = useLibrary();
  const { currentStudent } = useAuth();
  const { showToast } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // تصفية الكتب
  const filteredBooks = books.filter((book) => {
    const matchSearch =
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchAvailability = !onlyAvailable || book.availableCopiesCount > 0;

    return matchSearch && matchAvailability;
  });

  const handleReserve = (bookId: string) => {
    if (!currentStudent) {
      showToast('يرجى تسجيل الدخول أولاً لحجز الكتاب', 'warning');
      return;
    }

    const res = requestReservation(bookId, currentStudent.id);
    if (res.success) {
      showToast('تم إرسال طلب حجز الكتاب للمشرف بنجاح! 📚', 'success', 'طلب حجز معتمد');
    } else {
      showToast(res.error || 'تعذر إتمام طلب الحجز', 'error', 'تنبيه');
    }
  };

  const isEligible = currentStudent ? isStudentEligibleForLoan(currentStudent.id) : { eligible: true };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الكتاب، اسم المؤلف، أو موضوع القصة..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="rounded text-wathba-600 focus:ring-wathba-500"
              />
              <span>الكتب المتاحة فقط الآن</span>
            </label>
          </div>
        </div>
      </div>

      {/* Book Grid */}
      {filteredBooks.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-slate-700">لم يتم العثور على كتب مطابقة للبحث</h4>
          <p className="text-xs text-slate-400 mt-1">جرب البحث بكلمات أخرى أو برمز كتاب مختلف</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
          {filteredBooks.map((book) => {
            const category = categories.find((c) => c.id === book.categoryId);
            const isAvailable = book.availableCopiesCount > 0;
            const isReserved =
              currentStudent &&
              reservations.some(
                (r) =>
                  r.studentId === currentStudent.id &&
                  r.bookId === book.id &&
                  r.status !== 'fulfilled' &&
                  r.status !== 'cancelled' &&
                  r.status !== 'rejected'
              );

            return (
              <div
                key={book.id}
                className="group rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-soft hover:shadow-card hover:border-wathba-300 transition-all flex flex-col justify-between"
              >
                {/* Book Card Graphic (No Images) */}
                <div className="relative aspect-[4/3] bg-gradient-to-tr from-wathba-900 via-wathba-800 to-emerald-800 p-4 flex flex-col justify-between text-white overflow-hidden">
                  <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto text-gold-300">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="font-mono text-[10px] text-emerald-200 text-center block font-bold">
                    {book.code}
                  </span>
                </div>

                {/* Content */}
                <div className="p-3 flex-1 flex flex-col justify-between text-right">
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug group-hover:text-wathba-700 transition-colors">
                      {book.title}
                    </h4>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold ${
                        isAvailable ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {isAvailable ? `${book.availableCopiesCount} نسخ متاحة` : 'معار بالكامل'}
                    </span>
                    <button
                      onClick={() => setSelectedBook(book)}
                      className="text-xs text-wathba-700 hover:text-wathba-800 font-bold hover:underline"
                    >
                      عرض وحجز
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Book Details Modal */}
      {selectedBook && (
        <BookDetailsModal
          isOpen={!!selectedBook}
          onClose={() => setSelectedBook(null)}
          book={selectedBook}
          category={categories.find((c) => c.id === selectedBook.categoryId)}
          student={currentStudent}
          onReserve={handleReserve}
          isReservedByStudent={
            !!currentStudent &&
            reservations.some(
              (r) =>
                r.studentId === currentStudent.id &&
                r.bookId === selectedBook.id &&
                r.status !== 'fulfilled' &&
                r.status !== 'cancelled' &&
                r.status !== 'rejected'
            )
          }
          isEligibleToReserve={isEligible.eligible}
          eligibilityReason={isEligible.reason}
        />
      )}
    </div>
  );
};
