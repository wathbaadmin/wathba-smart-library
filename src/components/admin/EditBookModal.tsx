import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Category, Book } from '../../types';
import { BookOpen, CheckCircle, Save } from 'lucide-react';

interface EditBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  categories: Category[];
  onUpdateBook: (updated: Book) => void;
}

export const EditBookModal: React.FC<EditBookModalProps> = ({
  isOpen,
  onClose,
  book,
  categories,
  onUpdateBook,
}) => {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author || '');
  const [publisher, setPublisher] = useState(book.publisher || '');
  const [categoryId, setCategoryId] = useState(book.categoryId || categories[0]?.id || '');
  const [ageGroup, setAgeGroup] = useState(book.ageGroup || 'للجميع');
  const [pageCount, setPageCount] = useState<number | undefined>(book.pageCount);
  const [description, setDescription] = useState(book.description || '');
  const [coverImageUrl, setCoverImageUrl] = useState(book.coverImageUrl || '');
  const [isBookOfTheWeek, setIsBookOfTheWeek] = useState(book.isBookOfTheWeek || false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(book.title);
    setAuthor(book.author || '');
    setPublisher(book.publisher || '');
    setCategoryId(book.categoryId || categories[0]?.id || '');
    setAgeGroup(book.ageGroup || 'للجميع');
    setPageCount(book.pageCount);
    setDescription(book.description || '');
    setCoverImageUrl(book.coverImageUrl || '');
    setIsBookOfTheWeek(book.isBookOfTheWeek || false);
    setFormError(null);
  }, [book, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('عنوان الكتاب حقل إلزامي ولا يمكن تركه فارغاً');
      return;
    }

    onUpdateBook({
      ...book,
      title: title.trim(),
      author: author.trim(),
      publisher: publisher.trim(),
      categoryId,
      ageGroup,
      pageCount: pageCount ? Number(pageCount) : undefined,
      description: description.trim(),
      coverImageUrl: coverImageUrl.trim(),
      isBookOfTheWeek,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تعديل بيانات الكتاب"
      subtitle={`تعديل البيانات الأساسية لعنوان: ${book.title} (${book.code})`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="block text-xs font-bold text-slate-800">
              عنوان الكتاب: *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              aria-invalid={!!formError}
              className={`w-full min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 ${
                formError
                  ? 'border-rose-400 bg-rose-50/40 focus:ring-rose-500'
                  : 'border-slate-300 focus:ring-[#3b707d] focus:border-[#3b707d]'
              }`}
            />
            {formError && (
              <p className="text-[11px] font-bold text-rose-600">{formError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              اسم المؤلف:
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              دار النشر:
            </label>
            <input
              type="text"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              التصنيف:
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              الفئة العمرية المناسبة:
            </label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            >
              <option value="للجميع">للجميع</option>
              <option value="6-9 سنوات (البراعم)">6-9 سنوات (البراعم)</option>
              <option value="9-12 سنة (الأشبال)">9-12 سنة (الأشبال)</option>
              <option value="12-15 سنة (الفتيان)">12-15 سنة (الفتيان)</option>
              <option value="15+ سنة (المتقدمين)">15+ سنة (المتقدمين)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              عدد الصفحات:
            </label>
            <input
              type="number"
              min={1}
              value={pageCount || ''}
              onChange={(e) => setPageCount(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              رابط صورة الغلاف (URL):
            </label>
            <input
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-800">
            وصف أو نبذة عن الكتاب:
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
          ></textarea>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="bookOfTheWeek"
            checked={isBookOfTheWeek}
            onChange={(e) => setIsBookOfTheWeek(e.target.checked)}
            className="w-4 h-4 rounded text-[#3b707d] focus:ring-[#3b707d]"
          />
          <label htmlFor="bookOfTheWeek" className="text-xs font-bold text-slate-700 cursor-pointer">
            تمييز كـ «كتاب الأسبوع» في بوابة الطلاب ⭐
          </label>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose} type="button" className="w-full sm:w-auto">
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            icon={<Save className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold px-6"
          >
            حفظ التعديلات
          </Button>
        </div>
      </form>
    </Modal>
  );
};
