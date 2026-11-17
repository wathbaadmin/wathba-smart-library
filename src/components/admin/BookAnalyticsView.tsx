import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { formatArabicDate, isOverdue } from '../../lib/dateUtils';
import { Book } from '../../types';
import { BookFullDetailView } from './BookFullDetailView';
import {
  BarChart3,
  BookOpen,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Calendar,
  Users,
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Award,
  Layers,
  Sparkles,
} from 'lucide-react';

export const BookAnalyticsView: React.FC = () => {
  const { books, copies, loans, readingCompletions, categories, students } = useLibrary();

  const [periodPreset, setPeriodPreset] = useState<'all' | 'this_month' | 'this_term' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeAnalysisSection, setActiveAnalysisSection] = useState<
    'top_borrowed' | 'least_borrowed' | 'never_borrowed' | 'most_completed' | 'low_completion' | 'all_books_table'
  >('top_borrowed');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<Book | null>(null);

  // حساب النطاق الزمني
  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodPreset === 'this_month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return { from, to: now.toISOString(), label: 'خلال هذا الشهر' };
    }
    if (periodPreset === 'this_term') {
      const from = new Date(now.getFullYear(), Math.max(0, now.getMonth() - 3), 1).toISOString();
      return { from, to: now.toISOString(), label: 'الفصل الدراسي الحالي' };
    }
    if (periodPreset === 'custom' && customFrom) {
      return {
        from: new Date(`${customFrom}T00:00:00`).toISOString(),
        to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : now.toISOString(),
        label: `من ${customFrom} إلى ${customTo || 'الآن'}`,
      };
    }
    return { from: '', to: '', label: 'جميع الفترات منذ التأسيس' };
  }, [periodPreset, customFrom, customTo]);

  // تصفية الإعارات حسب الفترة المحددة
  const periodLoans = useMemo(() => {
    return (loans || []).filter((l) => {
      if (l.status === 'cancelled') return false;
      if (!dateRange.from) return true;
      const loanTime = new Date(l.loanDate).getTime();
      const fromTime = new Date(dateRange.from).getTime();
      const toTime = new Date(dateRange.to).getTime();
      return loanTime >= fromTime && loanTime <= toTime;
    });
  }, [loans, dateRange]);

  // تصفية الإكمالات المعتمدة
  const periodCompletions = useMemo(() => {
    return (readingCompletions || []).filter((c) => {
      if (c.status !== 'approved') return false;
      if (!dateRange.from) return true;
      const compTime = new Date(c.approvedAt || c.requestDate).getTime();
      const fromTime = new Date(dateRange.from).getTime();
      const toTime = new Date(dateRange.to).getTime();
      return compTime >= fromTime && compTime <= toTime;
    });
  }, [readingCompletions, dateRange]);

  // إحصائيات كل كتاب بدقة شديدة وفصل تام بين المفاهيم
  const booksStats = useMemo(() => {
    return books.map((book) => {
      const bookCopies = copies.filter((c) => c.bookId === book.id);
      const bookCopyIds = new Set(bookCopies.map((c) => c.id));
      const availableCopiesCount = bookCopies.filter((c) => c.status === 'available').length;

      // 1. عدد مرات الاستعارة الفعلية (كل عملية إعارة تُحسب مرة واحدة)
      const bookPeriodLoans = periodLoans.filter((l) => bookCopyIds.has(l.copyId));
      const totalBorrowsCount = bookPeriodLoans.length;

      // 2. عدد المستعيرين الفعليين (دون تكرار الطالب نفسه)
      const uniqueBorrowersCount = new Set(bookPeriodLoans.map((l) => l.studentId)).size;

      // 3. عدد مرات الإكمال المعتمدة
      const approvedCompletionsCount = periodCompletions.filter((c) => c.bookId === book.id).length;

      // نسبة الإكمال مقارنة بالاستعارات (Completion Rate)
      const completionRate =
        totalBorrowsCount > 0 ? Math.round((approvedCompletionsCount / totalBorrowsCount) * 100) : 0;

      // عدد الإعارات المتأخرة
      const overdueLoansCount = bookPeriodLoans.filter((l) => {
        if (l.status === 'overdue') return true;
        if (l.status === 'active' && isOverdue(l.dueDate)) return true;
        if (l.returnDate && new Date(l.returnDate).getTime() > new Date(l.dueDate).getTime()) return true;
        return false;
      }).length;

      return {
        book,
        totalCopiesCount: bookCopies.length,
        availableCopiesCount,
        totalBorrowsCount,
        uniqueBorrowersCount,
        approvedCompletionsCount,
        completionRate,
        overdueLoansCount,
      };
    });
  }, [books, copies, periodLoans, periodCompletions]);

  // الفئات التحليلية الخمس المطلوبة:
  // 1. أكثر الكتب استعارة (مرتبة تنازلياً ولديها إعارة واحدة على الأقل)
  const topBorrowedBooks = useMemo(() => {
    return [...booksStats].filter((b) => b.totalBorrowsCount > 0).sort((a, b) => b.totalBorrowsCount - a.totalBorrowsCount);
  }, [booksStats]);

  // 2. أقل الكتب استعارة (لديها إعارة ولكن بأقل الأرقام)
  const leastBorrowedBooks = useMemo(() => {
    return [...booksStats].filter((b) => b.totalBorrowsCount > 0).sort((a, b) => a.totalBorrowsCount - b.totalBorrowsCount);
  }, [booksStats]);

  // 3. كتب لم تتم استعارتها مطلقاً
  const neverBorrowedBooks = useMemo(() => {
    return booksStats.filter((b) => b.totalBorrowsCount === 0);
  }, [booksStats]);

  // 4. الكتب الأكثر إكمالاً من الطلاب
  const mostCompletedBooks = useMemo(() => {
    return [...booksStats]
      .filter((b) => b.approvedCompletionsCount > 0)
      .sort((a, b) => b.approvedCompletionsCount - a.approvedCompletionsCount);
  }, [booksStats]);

  // 5. الكتب التي تتم استعارتها كثيراً دون إكمال قراءتها (استعارات >= 2 ونسبة إكمال منخفضة < 40%)
  const lowCompletionBooks = useMemo(() => {
    return [...booksStats]
      .filter((b) => b.totalBorrowsCount >= 2 && b.completionRate < 50)
      .sort((a, b) => b.totalBorrowsCount - a.totalBorrowsCount);
  }, [booksStats]);

  // المجموع العام لمؤشرات المكتبة
  const overallMetrics = useMemo(() => {
    const totalLoans = periodLoans.length;
    const uniqueStudents = new Set(periodLoans.map((l) => l.studentId)).size;
    const totalCompletions = periodCompletions.length;
    const totalAvailableCopies = copies.filter((c) => c.status === 'available').length;
    const totalCopies = copies.length;

    return {
      totalLoans,
      uniqueStudents,
      totalCompletions,
      totalAvailableCopies,
      totalCopies,
    };
  }, [periodLoans, periodCompletions, copies]);

  // التصفية والبحث في جدول جميع الكتب
  const filteredTableBooks = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return booksStats;
    return booksStats.filter(
      (s) =>
        s.book.title.toLowerCase().includes(q) ||
        s.book.author.toLowerCase().includes(q) ||
        s.book.code.toLowerCase().includes(q)
    );
  }, [booksStats, searchTerm]);

  // عند النقر على تفاصيل كتاب
  if (selectedBookForDetails) {
    return (
      <BookFullDetailView
        book={selectedBookForDetails}
        onBack={() => setSelectedBookForDetails(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn text-right font-arabic">
      {/* الترويسة الرئيسية مع الفلتر الزمني */}
      <div className="bg-white rounded-3xl border border-[#dde6ed] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#1c353d] flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#3b707d]" />
              <span>إحصائيات وحركة استعارة الكتب</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              لوحة تحليلية مركزية توثق رحلة كل كتاب ومعدلات الاستعارة والإكمال المعتمدة بدقة تامة
            </p>
          </div>

          {/* محدد الفترة الزمنية */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#f4f7f9] p-1 rounded-xl border border-[#dde6ed] text-xs">
              <button
                type="button"
                onClick={() => setPeriodPreset('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  periodPreset === 'all'
                    ? 'bg-white text-[#1c353d] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                جميع الفترات
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('this_month')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  periodPreset === 'this_month'
                    ? 'bg-white text-[#1c353d] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('this_term')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  periodPreset === 'this_term'
                    ? 'bg-white text-[#1c353d] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الفصل الحالي
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('custom')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  periodPreset === 'custom'
                    ? 'bg-white text-[#1c353d] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                فترة مخصصة
              </button>
            </div>
          </div>
        </div>

        {/* منتقي التواريخ المخصص */}
        {periodPreset === 'custom' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-700">تحديد الفترة من وإلى:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
            <span className="text-slate-400">إلى</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold outline-none focus:ring-2 focus:ring-[#3b707d]"
            />
          </div>
        )}
      </div>

      {/* بطاقات المؤشرات الأربعة العامة (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#dde6ed] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">إجمالي عمليات الاستعارة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-[#1c353d] block">{overallMetrics.totalLoans}</strong>
          <span className="text-[11px] text-slate-400 font-medium">عمليات إعارة فعلية مسجلة</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#dde6ed] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">إجمالي الطلاب المستعيرين</span>
            <div className="w-8 h-8 rounded-xl bg-[#e3ecf3] text-[#2c5661] flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-[#2c5661] block">{overallMetrics.uniqueStudents}</strong>
          <span className="text-[11px] text-slate-400 font-medium">طلاب فريدون استفادوا من الإعارة</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#dde6ed] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">الكتب المقروءة والمعتمدة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-emerald-800 block">
            {overallMetrics.totalCompletions}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">قراءات اعتمدها المشرفون</span>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#dde6ed] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">النسخ المتاحة للإعارة</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <strong className="text-2xl font-black text-purple-900 block">
            {overallMetrics.totalAvailableCopies}
          </strong>
          <span className="text-[11px] text-slate-400 font-medium">
            من إجمالي {overallMetrics.totalCopies} نسخة ورقية
          </span>
        </div>
      </div>

      {/* أزرار التبديل بين الفئات التحليلية الخمس */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-soft">
        <button
          type="button"
          onClick={() => setActiveAnalysisSection('top_borrowed')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            activeAnalysisSection === 'top_borrowed'
              ? 'bg-[#3b707d] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>الأكثر استعارة ({topBorrowedBooks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAnalysisSection('least_borrowed')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            activeAnalysisSection === 'least_borrowed'
              ? 'bg-[#3b707d] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>الأقل استعارة ({leastBorrowedBooks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAnalysisSection('never_borrowed')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            activeAnalysisSection === 'never_borrowed'
              ? 'bg-[#3b707d] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>لم تُستعر مطلقاً ({neverBorrowedBooks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAnalysisSection('most_completed')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            activeAnalysisSection === 'most_completed'
              ? 'bg-[#3b707d] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>الأكثر إكمالاً ({mostCompletedBooks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAnalysisSection('low_completion')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            activeAnalysisSection === 'low_completion'
              ? 'bg-[#3b707d] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          <span>مستعارة دون إكمال ({lowCompletionBooks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAnalysisSection('all_books_table')}
          className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
            activeAnalysisSection === 'all_books_table'
              ? 'bg-[#3b707d] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>جدول فهرس المقارنة الشامل ({books.length})</span>
        </button>
      </div>

      {/* قسم العرض حسب الفئة المختارة */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft p-5 sm:p-6 space-y-4">
        {/* 1. أكثر الكتب استعارة */}
        {activeAnalysisSection === 'top_borrowed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-[#1c353d] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>قائمة الكتب الأكثر استعارة في المكتبة</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مرتبة حسب إجمالي عدد مرات الإعارة الفعلية الموثقة
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#3b707d]">
                {topBorrowedBooks.length} كتاب
              </span>
            </div>

            {topBorrowedBooks.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                لا توجد عمليات استعارة مسجلة في الفترة المحددة
              </div>
            ) : (
              <div className="space-y-3">
                {topBorrowedBooks.map((item, idx) => {
                  const maxBorrows = topBorrowedBooks[0]?.totalBorrowsCount || 1;
                  const pct = Math.max(8, Math.round((item.totalBorrowsCount / maxBorrows) * 100));

                  return (
                    <div
                      key={item.book.id}
                      onClick={() => setSelectedBookForDetails(item.book)}
                      className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-[#e3ecf3]/40 cursor-pointer transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-[#3b707d] text-white flex items-center justify-center font-mono font-black text-xs shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            {item.book.code}
                          </span>
                          <strong className="text-sm font-black text-[#1c353d] truncate group-hover:text-[#2c5661]">
                            {item.book.title}
                          </strong>
                          <span className="text-[11px] text-slate-500 hidden sm:inline truncate">
                            • {item.book.author}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono text-xs">
                          <span className="font-black text-[#1c353d] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            {item.totalBorrowsCount} استعارة
                          </span>
                          <span className="text-slate-500 hidden sm:inline">
                            {item.uniqueBorrowersCount} مستعير
                          </span>
                          <span className="text-emerald-700 font-bold hidden md:inline">
                            {item.approvedCompletionsCount} إكمال ({item.completionRate}%)
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2 rounded-full bg-[#e3ecf3] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-[#2c5661] to-[#3b707d] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. أقل الكتب استعارة */}
        {activeAnalysisSection === 'least_borrowed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-[#1c353d] flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-amber-600" />
                  <span>الكتب الأقل استعارة (تتطلب تنشيط وتوصية قرائية)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  كتب تمت استعارتها مرات قليلة، يوصى بعرضها في زاوية كتاب الأسبوع أو تشجيع المشرفين
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-amber-800">
                {leastBorrowedBooks.length} كتاب
              </span>
            </div>

            {leastBorrowedBooks.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                لا توجد كتب مستعارة في هذه الفئة
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {leastBorrowedBooks.map((item) => (
                  <div
                    key={item.book.id}
                    onClick={() => setSelectedBookForDetails(item.book)}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <span className="font-mono text-[10px] text-slate-400 font-bold block">
                        {item.book.code}
                      </span>
                      <h4 className="font-black text-sm text-[#1c353d] truncate">{item.book.title}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{item.book.author}</p>
                    </div>

                    <div className="text-left shrink-0">
                      <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-mono font-black text-xs block text-center">
                        {item.totalBorrowsCount} استعارة
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1 block">
                        {item.availableCopiesCount} نسخ متاحة
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. كتب لم تتم استعارتها مطلقاً */}
        {activeAnalysisSection === 'never_borrowed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-[#1c353d] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span>الكتب الراكدة (لم تتم استعارتها مطلقاً)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  كتب متوفرة في الفهرس وعلى الرفوف ولكن لم تُسجل لها أي استعارة بعد
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500">
                {neverBorrowedBooks.length} كتاب
              </span>
            </div>

            {neverBorrowedBooks.length === 0 ? (
              <div className="p-12 text-center text-xs text-emerald-700 bg-emerald-50 rounded-2xl font-bold">
                رائع! جميع الكتب في الفهرس شهدت استعارات من قِبل الطلاب.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {neverBorrowedBooks.map((item) => (
                  <div
                    key={item.book.id}
                    onClick={() => setSelectedBookForDetails(item.book)}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 hover:border-[#3b707d] cursor-pointer transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{item.book.code}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                        {item.totalCopiesCount} نسخ
                      </span>
                    </div>
                    <h4 className="font-black text-sm text-[#1c353d] leading-snug line-clamp-1">
                      {item.book.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">{item.book.author}</p>
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-[#3b707d] font-bold">
                      <span>جاهز للاستعارة</span>
                      <span className="flex items-center gap-1 text-[10px]">
                        <span>عرض التفاصيل</span>
                        <Eye className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. الكتب الأكثر إكمالاً من الطلاب */}
        {activeAnalysisSection === 'most_completed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-[#1c353d] flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" />
                  <span>الكتب الأكثر إكمالاً واعتماداً من قِبل المشرفين</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  كتب حظيت بأعلى نسب إتمام وقراءة فعلية موثقة من الطلاب
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-purple-900">
                {mostCompletedBooks.length} كتاب
              </span>
            </div>

            {mostCompletedBooks.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                لم يتم توثيق أي قراءات مكتملة معتمدة خلال هذه الفترة
              </div>
            ) : (
              <div className="space-y-3">
                {mostCompletedBooks.map((item, idx) => (
                  <div
                    key={item.book.id}
                    onClick={() => setSelectedBookForDetails(item.book)}
                    className="p-4 rounded-2xl bg-purple-50/40 border border-purple-200/70 hover:border-purple-400 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-purple-700 text-white flex items-center justify-center font-mono font-black text-xs shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <span className="font-mono text-[10px] text-slate-400 font-bold block">
                          {item.book.code}
                        </span>
                        <h4 className="font-black text-sm text-slate-900 truncate">{item.book.title}</h4>
                        <p className="text-[11px] text-slate-500 truncate">{item.book.author}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                      <div className="text-center">
                        <span className="block font-black text-purple-900 text-base">
                          {item.approvedCompletionsCount}
                        </span>
                        <span className="text-[10px] text-purple-700/80 font-medium font-arabic">
                          إكمال معتمد
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-slate-700 text-sm">
                          {item.totalBorrowsCount}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium font-arabic">
                          استعارات
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-emerald-700 text-sm">
                          {item.completionRate}%
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium font-arabic">
                          نسبة الإكمال
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. كتب تتم استعارتها كثيراً دون إكمال قراءتها */}
        {activeAnalysisSection === 'low_completion' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-[#1c353d] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span>كتب عالية الاستعارة ولكن منخفضة الإكمال (تسرب قرائي)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  كتب يُقبل عليها الطلاب بالاستعارة ولكن يعيدونها قبل إتمام قراءتها (قد تكون طويلة أو صعبة)
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-rose-900">
                {lowCompletionBooks.length} كتاب
              </span>
            </div>

            {lowCompletionBooks.length === 0 ? (
              <div className="p-12 text-center text-xs text-emerald-700 bg-emerald-50 rounded-2xl font-bold">
                ممتاز! لا توجد كتب تعاني من فجوة كبيرة بين الاستعارة والإكمال.
              </div>
            ) : (
              <div className="space-y-3">
                {lowCompletionBooks.map((item) => (
                  <div
                    key={item.book.id}
                    onClick={() => setSelectedBookForDetails(item.book)}
                    className="p-4 rounded-2xl bg-rose-50/30 border border-rose-200/80 hover:border-rose-400 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <span className="font-mono text-[10px] text-slate-400 font-bold block">
                        {item.book.code}
                      </span>
                      <h4 className="font-black text-sm text-slate-900 truncate">{item.book.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>المؤلف: {item.book.author}</span>
                        {item.book.pageCount && (
                          <span>• {item.book.pageCount} صفحة</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                      <div className="text-center">
                        <span className="block font-black text-[#1c353d] text-base">
                          {item.totalBorrowsCount}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium font-arabic">
                          استعارة
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-rose-700 text-sm">
                          {item.approvedCompletionsCount}
                        </span>
                        <span className="text-[10px] text-rose-600 font-medium font-arabic">
                          إكمال فقط
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block font-bold text-slate-500 text-sm">
                          {item.completionRate}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium font-arabic">
                          معدل الإنجاز
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. جدول فهرس المقارنة الشامل لجميع الكتب */}
        {activeAnalysisSection === 'all_books_table' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث في كتب الفهرس..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
                />
              </div>
              <span className="text-xs text-slate-500 font-mono">
                عرض {filteredTableBooks.length} من {books.length} كتاب
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">الكود والعنوان</th>
                    <th className="p-3.5">المؤلف</th>
                    <th className="p-3.5 text-center">النسخ الإجمالية</th>
                    <th className="p-3.5 text-center">النسخ المتاحة</th>
                    <th className="p-3.5 text-center">مرات الاستعارة</th>
                    <th className="p-3.5 text-center">الطلاب المستعيرون</th>
                    <th className="p-3.5 text-center">مرات الإكمال</th>
                    <th className="p-3.5 text-center">نسبة الإكمال</th>
                    <th className="p-3.5 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTableBooks.map((item) => (
                    <tr
                      key={item.book.id}
                      onClick={() => setSelectedBookForDetails(item.book)}
                      className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-slate-900">
                        <div className="truncate max-w-xs">{item.book.title}</div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {item.book.code}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-600 truncate max-w-[120px]">
                        {item.book.author}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                        {item.totalCopiesCount}
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            item.availableCopiesCount > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.availableCopiesCount} متاحة
                        </span>
                      </td>

                      <td className="p-3.5 text-center font-mono font-black text-[#1c353d]">
                        {item.totalBorrowsCount}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-[#2c5661]">
                        {item.uniqueBorrowersCount}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-purple-800">
                        {item.approvedCompletionsCount}
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        <span className="font-bold text-slate-700">{item.completionRate}%</span>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#e3ecf3] text-[#2c5661] font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>تفاصيل</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
