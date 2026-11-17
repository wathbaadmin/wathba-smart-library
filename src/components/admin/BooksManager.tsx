import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Book, Category } from '../../types';
import { AddBookModal } from './AddBookModal';
import { EditBookModal } from './EditBookModal';
import { CopiesManagerModal } from './CopiesManagerModal';
import { BookFullDetailView } from './BookFullDetailView';
import { BookLabelPrintSheet } from '../qr/BookLabelPrintSheet';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { exportToExcel } from '../../lib/exportUtils';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Layers,
  Edit,
  Trash2,
  LayoutGrid,
  List,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
  Tag,
  Check,
} from 'lucide-react';

export interface BooksManagerProps {
  onOpenStudentReport?: (studentId: string) => void;
  initialTab?: 'catalog' | 'categories';
}

export const BooksManager: React.FC<BooksManagerProps> = ({
  onOpenStudentReport,
  initialTab = 'catalog',
}) => {
  const { books, copies, loans, categories, addBook, updateBook, deleteBook, addCategory, updateCategory } = useLibrary();
  const { showToast } = useNotifications();

  const [sectionTab, setSectionTab] = useState<'catalog' | 'categories'>(initialTab);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('CAT');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  useEffect(() => {
    setSectionTab(initialTab);
  }, [initialTab]);

  const [selectedDetailBookId, setSelectedDetailBookId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical' | 'copies'>('recent');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalBook, setEditModalBook] = useState<Book | null>(null);
  const [copiesModalBook, setCopiesModalBook] = useState<Book | null>(null);
  const [batchPrintOpen, setBatchPrintOpen] = useState(false);

  // Filter & Sort
  const filteredBooks = books
    .filter((b) => {
      const matchSearch =
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory = selectedCategory === 'all' || b.categoryId === selectedCategory;

      let matchStatus = true;
      if (selectedStatus === 'available') {
        matchStatus = b.availableCopiesCount > 0;
      } else if (selectedStatus === 'out_of_stock') {
        matchStatus = b.availableCopiesCount === 0;
      }

      return matchSearch && matchCategory && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.title.localeCompare(b.title, 'ar');
      }
      if (sortBy === 'copies') {
        return b.totalCopiesCount - a.totalCopiesCount;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const handleExportExcel = () => {
    const data = books.map((b) => {
      const cat = categories.find((c) => c.id === b.categoryId);
      return {
        'رمز الكتاب': b.code,
        'عنوان الكتاب': b.title,
        'المؤلف': b.author || '-',
        'دار النشر': b.publisher || '-',
        'التصنيف': cat?.name || '-',
        'الفئة العمرية': b.ageGroup || 'للجميع',
        'عدد الصفحات': b.pageCount || '-',
        'إجمالي النسخ': b.totalCopiesCount,
        'النسخ المتاحة': b.availableCopiesCount,
        'كتاب الأسبوع': b.isBookOfTheWeek ? 'نعم' : 'لا',
      };
    });
    exportToExcel(data, 'فهرس_كتب_مكتبة_وثبة');
    showToast('تم تصدير كشف الكتب إلى ملف Excel بنجاح 📊', 'success');
  };

  // Safe Deletion Guard
  const handleDelete = (bookId: string) => {
    const bookCopies = copies.filter((c) => c.bookId === bookId);
    const hasActiveLoans = loans.some((l) =>
      (l.status === 'active' || l.status === 'overdue') &&
      bookCopies.some((c) => c.id === l.copyId)
    );

    if (hasActiveLoans) {
      showToast(
        'عفواً، لا يمكن حذف هذا الكتاب لوجود نسخ مستعارة حالياً لدى الطلاب! يجب استرجاعها أولاً إلى المكتبة.',
        'error',
        'حماية أمنية للبيانات'
      );
      return;
    }

    if (window.confirm('هل أنت متأكد من حذف هذا الكتاب وجميع نسخه الورقية من الفهرس نهائياً؟')) {
      deleteBook(bookId);
      showToast('تم حذف الكتاب ونسخه الورقية من الفهرس بنجاح', 'info');
    }
  };

  const selectedDetailBook = selectedDetailBookId
    ? books.find((b) => b.id === selectedDetailBookId)
    : undefined;

  if (selectedDetailBook) {
    return (
      <BookFullDetailView
        book={selectedDetailBook}
        onBack={() => setSelectedDetailBookId(null)}
        onNavigateToStudentReport={onOpenStudentReport}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 bg-[#f4f7f9] p-1 rounded-xl border border-[#dde6ed] w-fit">
        <button
          type="button"
          onClick={() => setSectionTab('catalog')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
            sectionTab === 'catalog'
              ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>فهرس الكتب والنسخ ({books.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setSectionTab('categories')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 ${
            sectionTab === 'categories'
              ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>تصنيفات الكتب ({categories.length})</span>
        </button>
      </div>

      {sectionTab === 'categories' ? (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#dde6ed] p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-[#1c353d]">إضافة تصنيف كتب جديد</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCategoryName.trim()) return;
                addCategory({
                  name: newCategoryName.trim(),
                  code: (newCategoryCode.trim() || `CAT-${categories.length + 1}`).toUpperCase(),
                  iconName: 'BookOpen',
                });
                setNewCategoryName('');
                setNewCategoryCode('CAT');
                showToast('تمت إضافة تصنيف الكتب بنجاح', 'success');
              }}
              className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
            >
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-slate-600">اسم التصنيف:</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="مثال: السيرة النبوية، العلوم والتقنية، الأدب العربي..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">رمز التصنيف:</label>
                <input
                  type="text"
                  dir="ltr"
                  value={newCategoryCode}
                  onChange={(e) => setNewCategoryCode(e.target.value.toUpperCase())}
                  placeholder="SCI"
                  className="h-10 w-28 px-3 rounded-xl border border-slate-300 font-mono text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                />
              </div>
              <Button type="submit" variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
                إضافة تصنيف
              </Button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-[#dde6ed] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#1c353d]">التصنيفات الحالية في المكتبة</h3>
              <span className="text-xs text-slate-500">{categories.length} تصنيف</span>
            </div>
            <div className="divide-y divide-slate-100">
              {categories.map((cat) => {
                const booksInCat = books.filter((b) => b.categoryId === cat.id).length;
                const isEditing = editingCategory?.id === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#f4f7f9]/60"
                  >
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, name: e.target.value })
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold flex-1 min-w-[180px]"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={editingCategory.code}
                          onChange={(e) =>
                            setEditingCategory({ ...editingCategory, code: e.target.value.toUpperCase() })
                          }
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs font-bold"
                        />
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => {
                            if (!editingCategory.name.trim()) return;
                            updateCategory(editingCategory);
                            setEditingCategory(null);
                            showToast('تم تحديث التصنيف بنجاح', 'success');
                          }}
                        >
                          حفظ
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingCategory(null)}
                        >
                          إلغاء
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 rounded-lg bg-[#e3ecf3] text-[#1c353d] font-mono text-[11px] font-black shrink-0">
                            {cat.code}
                          </span>
                          <div>
                            <span className="text-sm font-black text-[#1c353d] block">{cat.name}</span>
                            <span className="text-[11px] text-slate-500">{booksInCat} كتاب مرتبط</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={<Edit className="w-3.5 h-3.5" />}
                          onClick={() => setEditingCategory(cat)}
                        >
                          تعديل التصنيف
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Top Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-wathba-100 text-wathba-800">
              <BookOpen className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              إدارة فهرس الكتب والنسخ الورقية
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            فهرسة عناوين الكتب، متابعة تفاصيل المؤلف والتصنيف، توليد ملصقات الـ QR، وضوابط أمنية صارمة تمنع حذف الكتب ذات الإعارات النشطة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportExcel}
            className="text-xs font-bold"
          >
            تصدير Excel
          </Button>
          <Button
            variant="royal"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => setBatchPrintOpen(true)}
            className="text-xs font-bold"
          >
            طباعة ملصقات QR جماعية
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setAddModalOpen(true)}
            className="text-xs font-bold shadow-soft"
          >
            إضافة كتاب جديد
          </Button>
        </div>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e3ecf3] shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالعنوان، المؤلف، أو الرمز (WTH-000125)..."
              className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
            >
              <option value="all">كل التصنيفات</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Availability Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="available">نسخ متاحة للإعارة</option>
              <option value="out_of_stock">نفدت النسخ المتاحة</option>
            </select>

            {/* Sorting */}
            <div className="flex items-center gap-1.5 bg-[#f6f8fa] px-3 min-h-[44px] rounded-xl border border-slate-200">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#3b707d] shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-transparent font-bold text-slate-700 focus:outline-none min-h-[40px]"
              >
                <option value="recent">الأحدث إضافة</option>
                <option value="alphabetical">أبجدياً (أ - ي)</option>
                <option value="copies">الأكثر نسخاً</option>
              </select>
            </div>
          </div>
        </div>

        {/* View Toggle (Cards vs Table) */}
        <div className="flex items-center gap-1 p-1 bg-[#f6f8fa] border border-[#e3ecf3] rounded-xl shrink-0 self-end lg:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-all ${
              viewMode === 'cards' ? 'bg-[#3b707d] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="عرض البطاقات"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-all ${
              viewMode === 'table' ? 'bg-[#3b707d] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="عرض جدولي"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: CARDS VIEW ================= */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooks.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-[#e3ecf3] text-slate-400 text-xs">
              لم يتم العثور على كتب تطابق محددات البحث
            </div>
          ) : (
            filteredBooks.map((book) => {
              const cat = categories.find((c) => c.id === book.categoryId);
              const isAvailable = book.availableCopiesCount > 0;

              return (
                <div
                  key={book.id}
                  className="bg-white rounded-2xl border border-[#e3ecf3] p-4 sm:p-5 shadow-soft hover:shadow-card transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailBookId(book.id)}
                        className="flex items-center gap-3 text-right group flex-1 min-w-0"
                      >
                        <div className="w-12 h-16 rounded-xl bg-[#f6f8fa] border border-[#e3ecf3] text-[#3b707d] flex items-center justify-center font-bold shadow-sm shrink-0 overflow-hidden p-1">
                          {book.coverImageUrl ? (
                            <img
                              src={book.coverImageUrl}
                              alt={book.title}
                              loading="lazy"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <BookOpen className="w-6 h-6" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] text-slate-400 font-bold block">
                            {book.code}
                          </span>
                          <h3 className="font-black text-sm text-slate-900 group-hover:text-[#3b707d] leading-snug line-clamp-2">
                            {book.title}
                          </h3>
                          {book.author && (
                            <span className="text-[11px] text-slate-500 block truncate">
                              {book.author}
                            </span>
                          )}
                        </div>
                      </button>

                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 border ${
                          isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isAvailable ? (
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 shrink-0" />
                        )}
                        <span>{isAvailable ? `${book.availableCopiesCount} متاحة` : 'مستعارة'}</span>
                      </span>
                    </div>

                    {book.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {book.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                      {cat && (
                        <span className="px-2 py-0.5 rounded-lg bg-[#e3ecf3]/70 text-[#284d57] font-bold">
                          {cat.name}
                        </span>
                      )}
                      {book.ageGroup && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                          {book.ageGroup}
                        </span>
                      )}
                      {book.pageCount && (
                        <span className="text-slate-400">
                          {book.pageCount} صفحة
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDetailBookId(book.id)}
                      className="min-h-[40px] px-2.5 rounded-xl text-xs font-black text-[#3b707d] hover:bg-[#e3ecf3]/50 flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      <span>التفاصيل ({book.totalCopiesCount})</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCopiesModalBook(book)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60 transition-colors"
                        title="إدارة سريعة للنسخ والباركود"
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditModalBook(book)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60 transition-colors"
                        title="تعديل بيانات الكتاب"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(book.id)}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="حذف الكتاب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ================= VIEW 2: TABLE VIEW ================= */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-3xl border border-[#e3ecf3] overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#f6f8fa] text-slate-700 font-black border-b border-[#e3ecf3]">
                <tr>
                  <th className="p-4">الكتاب</th>
                  <th className="p-4">المؤلف</th>
                  <th className="p-4">التصنيف</th>
                  <th className="p-4">عدد الصفحات</th>
                  <th className="p-4">رمز العنوان</th>
                  <th className="p-4">النسخ الورقية</th>
                  <th className="p-4">المتاح حالياً</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      لم يتم العثور على كتب مطابقة
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map((book) => {
                    const cat = categories.find((c) => c.id === book.categoryId);
                    return (
                      <tr key={book.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                        <td className="p-4">
                          <button
                            type="button"
                            onClick={() => setSelectedDetailBookId(book.id)}
                            className="flex items-center gap-3 text-right group"
                          >
                            <div className="w-10 h-12 rounded-xl bg-[#f6f8fa] border border-[#e3ecf3] text-[#3b707d] flex items-center justify-center shadow-sm shrink-0 overflow-hidden p-0.5">
                              {book.coverImageUrl ? (
                                <img
                                  src={book.coverImageUrl}
                                  alt={book.title}
                                  loading="lazy"
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <BookOpen className="w-5 h-5" />
                              )}
                            </div>
                            <span className="font-bold text-slate-900 group-hover:text-[#3b707d] group-hover:underline">{book.title}</span>
                          </button>
                        </td>
                        <td className="p-4 text-slate-600">{book.author || '-'}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-lg bg-[#e3ecf3]/70 text-[#284d57] font-bold">
                            {cat?.name || '-'}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-slate-700">
                          {book.pageCount ? `${book.pageCount} صفحة` : '-'}
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-700">{book.code}</td>
                        <td className="p-4">
                          <button
                            onClick={() => setCopiesModalBook(book)}
                            className="font-bold text-[#3b707d] hover:underline flex items-center gap-1"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>{book.totalCopiesCount} نسخ</span>
                          </button>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full text-[11px] border ${
                              book.availableCopiesCount > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {book.availableCopiesCount > 0 ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            <span>{book.availableCopiesCount} متاحة</span>
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="primary"
                              size="sm"
                              icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => setSelectedDetailBookId(book.id)}
                            >
                              التفاصيل
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<Layers className="w-3.5 h-3.5" />}
                              onClick={() => setCopiesModalBook(book)}
                            >
                              QR
                            </Button>
                            <button
                              onClick={() => setEditModalBook(book)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-wathba-700 hover:bg-slate-100"
                              title="تعديل"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(book.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="حذف الكتاب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      )}

      {/* Add Book Modal */}
      {addModalOpen && (
        <AddBookModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          categories={categories}
          existingBooksCount={books.length}
          onAddBook={(data, copiesCount, shelf) => {
            addBook(data, copiesCount, shelf);
            showToast('تمت إضافة الكتاب وتوليد النسخ الورقية بنجاح! 📚', 'success');
          }}
        />
      )}

      {/* Edit Book Modal */}
      {editModalBook && (
        <EditBookModal
          isOpen={!!editModalBook}
          onClose={() => setEditModalBook(null)}
          book={editModalBook}
          categories={categories}
          onUpdateBook={(updated) => {
            updateBook(updated);
            showToast('تم حفظ تعديلات الكتاب بنجاح!', 'success');
          }}
        />
      )}

      {/* Manage Copies Modal */}
      {copiesModalBook && (
        <CopiesManagerModal
          isOpen={!!copiesModalBook}
          onClose={() => setCopiesModalBook(null)}
          book={copiesModalBook}
        />
      )}

      {/* Batch Print Labels Modal */}
      {batchPrintOpen && (
        <Modal
          isOpen={batchPrintOpen}
          onClose={() => setBatchPrintOpen(false)}
          title="طباعة ملصقات QR لجميع نسخ المكتبة"
          maxWidth="4xl"
        >
          <BookLabelPrintSheet
            copies={copies}
            books={books}
            onClose={() => setBatchPrintOpen(false)}
          />
        </Modal>
      )}
        </>
      )}
    </div>
  );
};
