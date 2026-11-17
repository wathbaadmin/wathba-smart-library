import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Category, Book } from '../../types';
import { BookOpen, CheckCircle, ChevronDown, ChevronUp, FileText, Layers } from 'lucide-react';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  existingBooksCount: number;
  onAddBook: (
    bookData: Omit<Book, 'id' | 'totalCopiesCount' | 'availableCopiesCount' | 'createdAt'>,
    numberOfCopies: number,
    shelf: string
  ) => void;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({
  isOpen,
  onClose,
  categories,
  existingBooksCount,
  onAddBook,
}) => {
  const nextCodeNum = 125 + existingBooksCount;
  const defaultCode = `WTH-000${nextCodeNum}`;

  const [title, setTitle] = useState('');
  const [bookCode, setBookCode] = useState(defaultCode);
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-general');
  const [ageGroup, setAgeGroup] = useState('للجميع');
  const [pageCount, setPageCount] = useState<number | undefined>();
  const [description, setDescription] = useState('');
  const [copiesCount, setCopiesCount] = useState(2);
  const [shelfLocation, setShelfLocation] = useState('الرف A1');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('يرجى إدخال عنوان الكتاب أولاً قبل الحفظ');
      return;
    }

    onAddBook(
      {
        code: bookCode.trim() || defaultCode,
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim(),
        description: description.trim(),
        categoryId: categoryId || categories[0]?.id || 'cat-general',
        ageGroup,
        pageCount:
          pageCount && Number(pageCount) > 0 ? Math.floor(Number(pageCount)) : undefined,
        coverImageUrl: '',
        isFeatured: false,
        isBookOfTheWeek: false,
      },
      Math.max(1, Number(copiesCount) || 1),
      shelfLocation.trim() || 'الرف العام'
    );

    // Reset and close
    setTitle('');
    setAuthor('');
    setPublisher('');
    setPageCount(undefined);
    setDescription('');
    setFormError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إضافة كتاب جديد وتوليد نسخه الورقية"
      subtitle="سجل بيانات عنوان الكتاب لتوليد رمزه والباركود الخاص بنسخه الورقية فوراً"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="p-4 rounded-2xl bg-[#e3ecf3]/60 border border-[#e3ecf3] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#3b707d] text-white flex items-center justify-center shrink-0 shadow-soft">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-right">
            <h4 className="text-xs font-black text-[#284d57]">الفهرسة الذكية للكتب</h4>
            <p className="text-[11px] text-slate-600">
              سيتم إنشاء معرف العنوان، وتوليد باركودات QR الفريدة لكل نسخة ورقية مستقلة تلقائياً.
            </p>
          </div>
        </div>

        {/* 1. عنوان الكتاب ورمزه */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              عنوان الكتاب: *
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="مثال: روائع التاريخ الإسلامي"
              aria-invalid={!!formError}
              className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 ${
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
              رمز العنوان المعتمد:
            </label>
            <input
              type="text"
              value={bookCode}
              onChange={(e) => setBookCode(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-center bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>
        </div>

        {/* 2. عدد النسخ، عدد الصفحات، وموقع الرف */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              عدد النسخ الورقية المتاحة:
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              <input
                type="number"
                min={1}
                max={50}
                value={copiesCount}
                onChange={(e) => setCopiesCount(Number(e.target.value))}
                className="w-full min-h-[44px] pr-9 pl-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              عدد صفحات الكتاب:
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              <input
                type="number"
                min={1}
                step={1}
                value={pageCount ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageCount(val ? Math.max(1, Math.floor(Number(val))) : undefined);
                }}
                placeholder="مثال: 120"
                className="w-full min-h-[44px] pr-9 pl-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              موقع الرف في المكتبة:
            </label>
            <input
              type="text"
              value={shelfLocation}
              onChange={(e) => setShelfLocation(e.target.value)}
              placeholder="مثال: الرف A1 - قسم التاريخ"
              className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>
        </div>

        {/* Toggle Advanced fields */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="min-h-[40px] text-xs font-bold text-[#3b707d] hover:text-[#284d57] flex items-center gap-1.5 py-1"
        >
          <span>{showAdvanced ? 'إخفاء التفاصيل التكميلية' : 'إضافة تفاصيل تكميلية (المؤلف، التصنيف، دار النشر)'}</span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">اسم المؤلف:</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="اسم الكاتب أو المترجم"
                  className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">دار النشر:</label>
                <input
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="دار النشر أو المؤسسة"
                  className="w-full min-h-[44px] px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">التصنيف:</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">الفئة العمرية:</label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                >
                  <option value="للجميع">للجميع</option>
                  <option value="6-9 سنوات (البراعم)">6-9 سنوات (البراعم)</option>
                  <option value="9-12 سنة (الأشبال)">9-12 سنة (الأشبال)</option>
                  <option value="12-15 سنة (الفتيان)">12-15 سنة (الفتيان)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">وصف أو نبذة:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="نبذة مختصرة عن موضوع الكتاب وما يستفيده الطالب منه..."
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
              ></textarea>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose} type="button" className="w-full sm:w-auto">
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            icon={<CheckCircle className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold px-6 shadow-soft"
          >
            تأكيد إضافة الكتاب والنسخ
          </Button>
        </div>
      </form>
    </Modal>
  );
};
