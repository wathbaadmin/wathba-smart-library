import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatArabicDate, getDaysRemaining, isOverdue } from '../../lib/dateUtils';
import { BookOpen, Clock, Calendar, CheckCircle, RotateCw, AlertTriangle, Sparkles, BookMarked } from 'lucide-react';

export const MyBooks: React.FC = () => {
  const { currentStudent } = useAuth();
  const {
    books,
    copies,
    getStudentActiveLoans,
    getStudentReservations,
    getStudentReadingHistory,
    extendLoan,
  } = useLibrary();
  const { showToast } = useNotifications();

  if (!currentStudent) return null;

  const activeLoans = getStudentActiveLoans(currentStudent.id);
  const reservations = getStudentReservations(currentStudent.id);
  const history = getStudentReadingHistory(currentStudent.id);

  const handleExtend = (loanId: string) => {
    const res = extendLoan(loanId, currentStudent.fullName);
    if (res.success) {
      showToast('تم تمديد موعد إعادة الكتاب بنجاح!', 'success');
    } else {
      showToast(res.error || 'تعذر تمديد الإعارة', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Achievement & Stats Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-l from-emerald-600 via-wathba-700 to-emerald-800 text-white shadow-soft flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center sm:text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold text-white mb-1">
            <Sparkles className="w-3.5 h-3.5 text-gold-300" />
            <span>بطاقة إنجاز القراءة الشخصية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black">
            سجل إنجازاتك يا بطل وثبة: {currentStudent.fullName}
          </h2>
          <p className="text-xs text-emerald-100 leading-relaxed max-w-lg">
            كل كتاب تقرؤه يضيف لك نوراً ومعرفة وخبرة جديدة. استمر في القراءة وبناء مستقبلك!
          </p>
        </div>

        {/* Counter Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
            <span className="block text-2xl font-black text-white">{currentStudent.totalBooksRead}</span>
            <span className="text-[11px] text-emerald-200">كتب أتممت قراءتها</span>
          </div>
          <div className="px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
            <span className="block text-2xl font-black text-gold-300">{activeLoans.length}</span>
            <span className="text-[11px] text-emerald-200">كتب معك حالياً</span>
          </div>
        </div>
      </div>

      {/* 1. الكتب المستعارة حالياً */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">الكتب المستعارة بين يديك</h3>
              <p className="text-xs text-slate-500">احرص على سلامة الكتاب وإعادته في الموعد المحدد</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {activeLoans.length} من الحد الأقصى (2 كتب)
          </span>
        </div>

        {activeLoans.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            ليس لديك أي كتب مستعارة حالياً. تصفح الفهرس واحجز كتابك المفضل!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeLoans.map((loan) => {
              const copy = copies.find((c) => c.id === loan.copyId);
              const book = books.find((b) => b.id === copy?.bookId);
              const remaining = getDaysRemaining(loan.dueDate);
              const late = isOverdue(loan.dueDate);

              return (
                <div
                  key={loan.id}
                  className={`p-4 rounded-2xl bg-white border shadow-soft flex gap-4 transition-all ${
                    late ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                  }`}
                >
                  <div className="w-14 h-20 rounded-2xl bg-gradient-to-tr from-wathba-800 to-emerald-600 text-gold-300 flex items-center justify-center shadow-xs shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-sm text-slate-900 leading-snug">
                          {book?.title || 'كتاب وثبة'}
                        </h4>
                        <Badge
                          status={late ? 'overdue' : 'borrowed'}
                          label={late ? 'متأخر' : 'مستعار'}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block mt-1">
                        رمز النسخة: {copy?.copyCode}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[11px]">
                        <span className="text-slate-500 block">موعد الإرجاع:</span>
                        <span
                          className={`font-bold ${
                            late ? 'text-rose-600' : remaining <= 2 ? 'text-amber-600' : 'text-slate-800'
                          }`}
                        >
                          {formatArabicDate(loan.dueDate)} ({late ? 'متأخر!' : `باقي ${remaining} أيام`})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. طلبات الحجز القائمة */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-800">طلبات الحجز وقيد التجهيز</h3>
            <p className="text-xs text-slate-500">حالة طلباتك التي تنتظر الاستلام</p>
          </div>
        </div>

        {reservations.filter((r) => r.status !== 'fulfilled' && r.status !== 'cancelled').length === 0 ? (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            لا توجد طلبات حجز قيد الانتظار حالياً
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reservations
              .filter((r) => r.status !== 'fulfilled' && r.status !== 'cancelled')
              .map((res) => {
                const book = books.find((b) => b.id === res.bookId);

                return (
                  <div
                    key={res.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-soft flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-16 rounded-xl bg-gradient-to-tr from-wathba-800 to-emerald-600 text-gold-300 flex items-center justify-center shadow-xs shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                          {book?.title}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                          {book?.code}
                        </span>
                        <div className="mt-1.5">
                          <Badge status={res.status} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 3. سجل القراءات والكتب المعادة */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-royal-100 text-royal-800">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-800">سجل قراءاتك السابقة</h3>
            <p className="text-xs text-slate-500">الكتب التي أتممت قراءتها وأعدتها للمكتبة بنجاح</p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            لم تسجل بعد أي كتب معادة في سجلك
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">عنوان الكتاب</th>
                    <th className="p-3.5">تاريخ الاستعارة</th>
                    <th className="p-3.5">تاريخ الإرجاع</th>
                    <th className="p-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => {
                    const copy = copies.find((c) => c.id === h.copyId);
                    const book = books.find((b) => b.id === copy?.bookId);

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="p-3.5 font-bold text-slate-800">
                          {book?.title || 'كتاب وثبة'}
                        </td>
                        <td className="p-3.5 text-slate-500">{formatArabicDate(h.loanDate)}</td>
                        <td className="p-3.5 text-slate-500">{formatArabicDate(h.returnDate)}</td>
                        <td className="p-3.5">
                          <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            تمت القراءة بنجاح ✨
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
