import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { ReturnRequest, ExchangeRequest } from '../../types';
import { formatArabicDate, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { Button } from '../common/Button';
import {
  RotateCcw,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  Layers,
  ChevronLeft,
  Sparkles,
  Info,
  Ban,
} from 'lucide-react';

export const StudentRequestsView: React.FC = () => {
  const { currentStudent } = useAuth();
  const {
    returnRequests,
    exchangeRequests,
    books,
    copies,
    cancelReturnRequest,
    cancelExchangeRequest,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [filterType, setFilterType] = useState<'all' | 'returns' | 'exchanges'>('all');

  if (!currentStudent) return null;

  const studentReturns = (returnRequests || []).filter((r) => r.studentId === currentStudent.id);
  const studentExchanges = (exchangeRequests || []).filter((e) => e.studentId === currentStudent.id);

  // Status mapping
  const getReturnStatusBadge = (status: ReturnRequest['status']) => {
    switch (status) {
      case 'new':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">طلب جديد</span>;
      case 'in_review':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">قيد المراجعة</span>;
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">تمت الموافقة</span>;
      case 'waiting_for_pickup':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">بانتظار تسليم الكتاب</span>;
      case 'received':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">تم الاستلام في المكتبة</span>;
      case 'under_inspection':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">قيد فحص النسخة</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">مكتمل ومغلق</span>;
      case 'rejected':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">مرفوض</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">ملغي</span>;
      default:
        return null;
    }
  };

  const getExchangeStatusBadge = (status: ExchangeRequest['status']) => {
    switch (status) {
      case 'new':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">طلب استبدال جديد</span>;
      case 'in_review':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">قيد المراجعة</span>;
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">تمت الموافقة وتجهيز البديل</span>;
      case 'waiting_for_old_book':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">بانتظار إحضار الكتاب الحالي</span>;
      case 'old_book_received':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">تم استلام الكتاب وفحصه</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">تم الاستبدال بنجاح</span>;
      case 'rejected':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">مرفوض</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">ملغي</span>;
      default:
        return null;
    }
  };

  const handleCancelReturn = (id: string) => {
    const res = cancelReturnRequest(id);
    if (res.success) {
      showToast('تم إلغاء طلب الإرجاع بنجاح', 'info');
    } else {
      showToast(res.error || 'تعذر إلغاء الطلب', 'error');
    }
  };

  const handleCancelExchange = (id: string) => {
    const res = cancelExchangeRequest(id);
    if (res.success) {
      showToast('تم إلغاء طلب الاستبدال بنجاح', 'info');
    } else {
      showToast(res.error || 'تعذر إلغاء الطلب', 'error');
    }
  };

  const hasAnyRequests = studentReturns.length > 0 || studentExchanges.length > 0;

  return (
    <div className="space-y-6">
      {/* Header & Subtitle */}
      <div className="bg-white rounded-3xl border border-emerald-100 p-6 shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>سجل الطلبات الرسمية</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            متابعة طلبات الإرجاع والاستبدال
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تابع حالة طلباتك لمعرفة موعد تسليم الكتاب لمشرف المكتبة أو استلام البديل
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-[#f6f8fa] p-1.5 rounded-2xl border border-[#e3ecf3] text-xs font-bold overflow-x-auto max-w-full">
          <button
            onClick={() => setFilterType('all')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              filterType === 'all'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({studentReturns.length + studentExchanges.length})
          </button>
          <button
            onClick={() => setFilterType('returns')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              filterType === 'returns'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الإرجاع ({studentReturns.length})
          </button>
          <button
            onClick={() => setFilterType('exchanges')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              filterType === 'exchanges'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الاستبدال ({studentExchanges.length})
          </button>
        </div>
      </div>

      {/* Notice info */}
      <div className="p-4 rounded-2xl bg-wathba-50/70 border border-wathba-200 text-xs text-wathba-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-wathba-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>إجراءات التسليم بالمكتبة:</strong> عند اعتماد طلبك وظهور حالة «بانتظار تسليم الكتاب» أو «بانتظار إحضار الكتاب الحالي»، تفضل بزيارة المكتبة لتسليم الكتاب لمشرف الصالة واستلام النسخة البديلة فوراً.
        </div>
      </div>

      {/* Requests Content List */}
      {!hasAnyRequests ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-soft space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="font-black text-slate-800 text-base">
            ليس لديك أي طلبات إرجاع أو استبدال حالياً
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            يمكنك تقديم طلب إرجاع أو استبدال لأي كتاب مستعار في عهدتك مباشرة من تبويب «كتبي».
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 1. Return Requests */}
          {(filterType === 'all' || filterType === 'returns') &&
            studentReturns.map((req) => {
              const book = books.find((b) => b.id === req.bookId);
              const copy = copies.find((c) => c.id === req.copyId);
              const canCancel = req.status === 'new' || req.status === 'in_review';

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-soft hover:shadow-card transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-wathba-100 text-wathba-800 flex items-center justify-center font-bold shrink-0">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">
                            طلب إرجاع كتاب
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 font-bold">
                            #{req.id.slice(-6)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>تاريخ الطلب: {formatUmmAlQuraDate(req.createdAt)} ({formatArabicDate(req.createdAt)})</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getReturnStatusBadge(req.status)}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => handleCancelReturn(req.id)}
                          className="px-2.5 py-1 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" />
                          <span>إلغاء الطلب</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Book Info */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-12 rounded-xl bg-wathba-700 text-white flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-wathba-100" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-slate-900 truncate">
                          {book?.title || 'كتاب مستعار'}
                        </h4>
                        <span className="text-[11px] text-slate-500 block truncate">
                          نسخة: {copy?.copyCode || '-'} • الرف: {copy?.shelfLocation || 'الرف العام'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Pickup Time Alert */}
                  {req.scheduledPickupTime && (
                    <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>موعد أو تعليمات التسليم المحددة من المشرف:</strong>
                        <p className="mt-0.5 text-purple-800">{req.scheduledPickupTime}</p>
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason Alert */}
                  {req.status === 'rejected' && req.rejectionReason && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>سبب رفض الطلب:</strong>
                        <p className="mt-0.5 text-rose-800">{req.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Student Note */}
                  {req.studentNotes && (
                    <div className="text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-600">ملاحظتك:</span> {req.studentNotes}
                    </div>
                  )}
                </div>
              );
            })}

          {/* 2. Exchange Requests */}
          {(filterType === 'all' || filterType === 'exchanges') &&
            studentExchanges.map((req) => {
              const oldBook = books.find((b) => b.id === req.oldBookId);
              const oldCopy = copies.find((c) => c.id === req.oldCopyId);
              const newBook = books.find((b) => b.id === req.newBookId);
              const canCancel = req.status === 'new' || req.status === 'in_review';

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-soft hover:shadow-card transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                        <ArrowLeftRight className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">
                            طلب استبدال كتاب
                          </span>
                          <span className="font-mono text-[11px] text-slate-400 font-bold">
                            #{req.id.slice(-6)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>تاريخ الطلب: {formatUmmAlQuraDate(req.createdAt)} ({formatArabicDate(req.createdAt)})</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getExchangeStatusBadge(req.status)}
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => handleCancelExchange(req.id)}
                          className="px-2.5 py-1 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Ban className="w-3 h-3" />
                          <span>إلغاء الطلب</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Books Exchange Flow Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Old Book */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                      <div className="w-9 h-12 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-slate-300" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full inline-block">
                          كتابك الحالي للتسليم
                        </span>
                        <h5 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                          {oldBook?.title || 'كتاب حالي'}
                        </h5>
                        <span className="text-[10px] text-slate-400 block truncate">
                          نسخة: {oldCopy?.copyCode || '-'}
                        </span>
                      </div>
                    </div>

                    {/* New Book */}
                    <div className="p-3 rounded-2xl bg-wathba-50/70 border border-wathba-200 flex items-center gap-3">
                      <div className="w-9 h-12 rounded-xl bg-wathba-700 text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-wathba-100" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-wathba-800 bg-wathba-100 px-1.5 py-0.5 rounded-full inline-block">
                          الكتاب الجديد المطلوب ✨
                        </span>
                        <h5 className="font-bold text-xs text-wathba-900 truncate mt-0.5">
                          {newBook?.title || 'كتاب جديد'}
                        </h5>
                        <span className="text-[10px] text-slate-500 block truncate">
                          المؤلف: {newBook?.author || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Pickup Time Alert */}
                  {req.scheduledPickupTime && (
                    <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>موعد أو مكان الاستبدال المحدد من المشرف:</strong>
                        <p className="mt-0.5 text-purple-800">{req.scheduledPickupTime}</p>
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason Alert */}
                  {req.status === 'rejected' && req.rejectionReason && (
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>سبب رفض الطلب:</strong>
                        <p className="mt-0.5 text-rose-800">{req.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Student Note */}
                  {req.studentNotes && (
                    <div className="text-[11px] text-slate-500 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-600">ملاحظتك:</span> {req.studentNotes}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
