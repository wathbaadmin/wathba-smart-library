import React, { useState } from 'react';
import { Loan, Book, BookCopy } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  ArrowLeftRight,
  BookOpen,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  Layers,
} from 'lucide-react';

interface ExchangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan;
  book?: Book;
  copy?: BookCopy;
  onSuccess?: () => void;
}

export const ExchangeRequestModal: React.FC<ExchangeRequestModalProps> = ({
  isOpen,
  onClose,
  loan,
  book,
  copy,
  onSuccess,
}) => {
  const { books, copies, categories, submitExchangeRequest } = useLibrary();
  const { showToast } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNewBookId, setSelectedNewBookId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Available books to exchange for (different from current book, with at least 1 available copy)
  const availableBooks = books.filter(
    (b) => b.id !== book?.id && b.availableCopiesCount > 0
  );

  const filteredBooks = availableBooks.filter((b) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const cat = categories.find((c) => c.id === b.categoryId);
    return (
      b.title.toLowerCase().includes(term) ||
      b.author.toLowerCase().includes(term) ||
      (cat && cat.name.toLowerCase().includes(term))
    );
  });

  const selectedNewBook = books.find((b) => b.id === selectedNewBookId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNewBookId) {
      showToast('يرجى اختيار الكتاب البديل الذي ترغب في استعارته', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = submitExchangeRequest(loan.id, selectedNewBookId, notes);
      if (res.success) {
        showToast(
          'تم إرسال طلب استبدال الكتاب بنجاح! 🔄 سيقوم المشرف بمراجعته وتجهيز الكتاب الجديد لك.',
          'success',
          'تم تقديم الطلب'
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.error || 'تعذر إرسال طلب الاستبدال', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="طلب استبدال كتاب مستعار"
      subtitle="إرجاع كتابك الحالي واختيار كتاب بديل متوفر في المكتبة"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-right">
        {/* Comparison Summary: Old Book vs New Book */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
          {/* Current Book */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-12 h-16 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <BookOpen className="w-6 h-6 text-slate-300" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block mb-1">
                الكتاب الحالي (سيتم تسليمه)
              </span>
              <h5 className="font-black text-xs text-slate-900 truncate">
                {book?.title || 'كتابك المستعار'}
              </h5>
              <span className="text-[11px] text-slate-500 block truncate">
                نسخة: {copy?.copyCode || '-'}
              </span>
            </div>
          </div>

          {/* New Book To Receive */}
          <div className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
            selectedNewBook
              ? 'bg-wathba-50/70 border-wathba-300 ring-2 ring-wathba-100'
              : 'bg-dashed border-dashed border-slate-300 bg-slate-50/50 justify-center text-center'
          }`}>
            {selectedNewBook ? (
              <>
                <div className="w-12 h-16 rounded-xl bg-gradient-to-tr from-wathba-800 to-wathba-600 text-white flex items-center justify-center shrink-0 shadow-soft">
                  <Sparkles className="w-6 h-6 text-wathba-100" />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <span className="text-[10px] font-bold text-wathba-800 bg-wathba-100 px-2 py-0.5 rounded-full inline-block mb-1">
                    الكتاب الجديد المختار ✨
                  </span>
                  <h5 className="font-black text-xs text-wathba-900 truncate">
                    {selectedNewBook.title}
                  </h5>
                  <span className="text-[11px] text-slate-500 block truncate">
                    تأليف: {selectedNewBook.author}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center py-2 text-slate-400">
                <ArrowLeftRight className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                <span className="text-xs font-medium">اختر كتاباً بديلاً من القائمة أدناه</span>
              </div>
            )}
          </div>
        </div>

        {/* Selection Area: Search and Book Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700">
              اختر الكتاب البديل المتوفر بالمكتبة:
            </label>
            <span className="text-[11px] text-slate-500">
              ({availableBooks.length} كتاب متاح للاستبدال)
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالعنوان، المؤلف، أو التصنيف..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Scrollable Book Grid / List */}
          <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 border border-slate-200 rounded-2xl bg-slate-50/50 custom-scrollbar">
            {filteredBooks.length > 0 ? (
              filteredBooks.map((b) => {
                const isSelected = selectedNewBookId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedNewBookId(b.id)}
                    className={`w-full p-2.5 rounded-xl border text-right transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-wathba-700 text-white border-wathba-700 shadow-xs'
                        : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-wathba-50 text-wathba-700'
                      }`}>
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className={`font-bold text-xs truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {b.title}
                        </div>
                        <div className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                          {b.author} • {categories.find((c) => c.id === b.categoryId)?.name || 'عام'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        متوفر: {b.availableCopiesCount}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                لا توجد نتائج مطابقة لبحثك
              </div>
            )}
          </div>
        </div>

        {/* Optional Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            سبب الاستبدال أو ملاحظات إضافية (اختياري):
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="مثال: انتهيت من قراءة الكتاب الحالي وأريد البدء في قراءة الكتاب الجديد..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Regulatory & Safety Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            <strong>ضوابط الاستبدال:</strong> بعد اعتماد الطلب من المشرف وتجهيز الكتاب الجديد، عليك إحضار كتابك الحالي للمكتبة؛ سيتم فحصه أولاً ثم تسليمك الكتاب الجديد يدوياً وتحديث سجل إعاراتك.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={submitting}
            className="text-xs font-bold"
          >
            إلغاء
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={submitting}
            disabled={!selectedNewBookId}
            className="text-xs font-bold flex items-center gap-2 bg-wathba-700 hover:bg-wathba-800 text-white disabled:opacity-50"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>إرسال طلب الاستبدال</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
