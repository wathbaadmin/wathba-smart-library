import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  ReturnRequest,
  ExchangeRequest,
  ReturnRequestStatus,
  ExchangeRequestStatus,
  ConditionRating,
} from '../../types';
import { formatArabicDate, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  RotateCcw,
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Layers,
  BookOpen,
  Calendar,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronRight,
  PackageCheck,
  UserCheck,
} from 'lucide-react';

export interface RequestsManagerViewProps {
  initialTab?: 'all' | 'returns' | 'exchanges';
}

export const RequestsManagerView: React.FC<RequestsManagerViewProps> = ({
  initialTab = 'all',
}) => {
  const { currentStaff } = useAuth();
  const {
    returnRequests,
    exchangeRequests,
    books,
    copies,
    students,
    loans,
    updateReturnRequestStatus,
    updateExchangeRequestStatus,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<'all' | 'returns' | 'exchanges'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Modal Action States
  const [selectedReturnForAction, setSelectedReturnForAction] = useState<{
    request: ReturnRequest;
    action: 'approve' | 'reject' | 'receive' | 'complete';
  } | null>(null);

  const [selectedExchangeForAction, setSelectedExchangeForAction] = useState<{
    request: ExchangeRequest;
    action: 'approve' | 'reject' | 'receive' | 'complete';
  } | null>(null);

  // Form fields inside modals
  const [pickupTimeInput, setPickupTimeInput] = useState('');
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [conditionRatingInput, setConditionRatingInput] = useState<ConditionRating>('good');
  const [inspectionNotesInput, setInspectionNotesInput] = useState('');
  const [assignedCopyIdInput, setAssignedCopyIdInput] = useState('');

  const safeReturns = returnRequests || [];
  const safeExchanges = exchangeRequests || [];

  // Quick stats
  const totalNewRequests =
    safeReturns.filter((r) => r.status === 'new').length +
    safeExchanges.filter((e) => e.status === 'new').length;

  const totalWaitingPickup =
    safeReturns.filter((r) => r.status === 'approved' || r.status === 'waiting_for_pickup').length +
    safeExchanges.filter((e) => e.status === 'approved' || e.status === 'waiting_for_old_book').length;

  const totalUnderInspection =
    safeReturns.filter((r) => r.status === 'under_inspection' || r.status === 'received').length +
    safeExchanges.filter((e) => e.status === 'old_book_received').length;

  const totalCompleted =
    safeReturns.filter((r) => r.status === 'completed').length +
    safeExchanges.filter((e) => e.status === 'completed').length;

  // Filter logic
  const filteredReturns = safeReturns.filter((r) => {
    const student = (students || []).find((s) => s.id === r.studentId);
    const book = (books || []).find((b) => b.id === r.bookId);
    const term = searchTerm.toLowerCase().trim();

    const matchesSearch =
      !term ||
      student?.fullName.toLowerCase().includes(term) ||
      student?.grade.toLowerCase().includes(term) ||
      book?.title.toLowerCase().includes(term) ||
      r.id.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredExchanges = safeExchanges.filter((e) => {
    const student = (students || []).find((s) => s.id === e.studentId);
    const oldBook = (books || []).find((b) => b.id === e.oldBookId);
    const newBook = (books || []).find((b) => b.id === e.newBookId);
    const term = searchTerm.toLowerCase().trim();

    const matchesSearch =
      !term ||
      student?.fullName.toLowerCase().includes(term) ||
      student?.grade.toLowerCase().includes(term) ||
      oldBook?.title.toLowerCase().includes(term) ||
      newBook?.title.toLowerCase().includes(term) ||
      e.id.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Execute Return Actions
  const handleExecuteReturnAction = () => {
    if (!selectedReturnForAction || !currentStaff) return;
    const { request, action } = selectedReturnForAction;

    let targetStatus: ReturnRequestStatus = request.status;
    if (action === 'approve') targetStatus = 'waiting_for_pickup';
    if (action === 'reject') {
      if (!rejectionReasonInput.trim()) {
        showToast('يرجى كتابة سبب رفض الطلب', 'error');
        return;
      }
      targetStatus = 'rejected';
    }
    if (action === 'receive') targetStatus = 'under_inspection';
    if (action === 'complete') targetStatus = 'completed';

    const res = updateReturnRequestStatus({
      requestId: request.id,
      status: targetStatus,
      rejectionReason: action === 'reject' ? rejectionReasonInput.trim() : undefined,
      scheduledPickupTime: action === 'approve' ? pickupTimeInput.trim() : undefined,
      staffId: currentStaff.id,
      conditionRating: conditionRatingInput,
      inspectionNotes: inspectionNotesInput.trim(),
    });

    if (res.success) {
      showToast('تم تحديث حالة طلب الإرجاع بنجاح', 'success');
      setSelectedReturnForAction(null);
      setPickupTimeInput('');
      setRejectionReasonInput('');
      setInspectionNotesInput('');
    } else {
      showToast(res.error || 'تعذر تحديث الطلب', 'error');
    }
  };

  // Execute Exchange Actions
  const handleExecuteExchangeAction = () => {
    if (!selectedExchangeForAction || !currentStaff) return;
    const { request, action } = selectedExchangeForAction;

    let targetStatus: ExchangeRequestStatus = request.status;
    if (action === 'approve') targetStatus = 'waiting_for_old_book';
    if (action === 'reject') {
      if (!rejectionReasonInput.trim()) {
        showToast('يرجى كتابة سبب رفض الطلب', 'error');
        return;
      }
      targetStatus = 'rejected';
    }
    if (action === 'receive') targetStatus = 'old_book_received';
    if (action === 'complete') targetStatus = 'completed';

    const res = updateExchangeRequestStatus({
      requestId: request.id,
      status: targetStatus,
      assignedNewCopyId: assignedCopyIdInput || undefined,
      rejectionReason: action === 'reject' ? rejectionReasonInput.trim() : undefined,
      scheduledPickupTime: action === 'approve' ? pickupTimeInput.trim() : undefined,
      staffId: currentStaff.id,
      conditionRating: conditionRatingInput,
      inspectionNotes: inspectionNotesInput.trim(),
    });

    if (res.success) {
      showToast('تم تحديث حالة طلب الاستبدال بنجاح', 'success');
      setSelectedExchangeForAction(null);
      setPickupTimeInput('');
      setRejectionReasonInput('');
      setInspectionNotesInput('');
      setAssignedCopyIdInput('');
    } else {
      showToast(res.error || 'تعذر تحديث الطلب', 'error');
    }
  };

  // Status badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">جديد</span>;
      case 'in_review':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">قيد المراجعة</span>;
      case 'approved':
      case 'waiting_for_pickup':
      case 'waiting_for_old_book':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">بانتظار التسليم</span>;
      case 'received':
      case 'under_inspection':
      case 'old_book_received':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">قيد الفحص بالرف</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">مكتمل ومغلق</span>;
      case 'rejected':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">مرفوض</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">ملغي</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            إدارة طلبات الإرجاع والاستبدال
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            مراجعة طلبات الطلاب، جدولة تسليم الكتب، وإجراءات الفحص والاستبدال الميداني
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-[#f6f8fa] p-1.5 rounded-2xl border border-[#e3ecf3] text-xs font-bold overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('all')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'all'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({returnRequests.length + exchangeRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'returns'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الإرجاع ({returnRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('exchanges')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-all ${
              activeTab === 'exchanges'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الاستبدال ({exchangeRequests.length})
          </button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-4 border border-blue-100 shadow-soft flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xl font-black text-slate-900">{totalNewRequests}</span>
            <span className="text-xs text-slate-500">طلبات جديدة</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-purple-100 shadow-soft flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xl font-black text-slate-900">{totalWaitingPickup}</span>
            <span className="text-xs text-slate-500">بانتظار التسليم باليد</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-cyan-100 shadow-soft flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xl font-black text-slate-900">{totalUnderInspection}</span>
            <span className="text-xs text-slate-500">قيد الفحص بالرف</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-emerald-100 shadow-soft flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-xl font-black text-slate-900">{totalCompleted}</span>
            <span className="text-xs text-slate-500">طلبات مكتملة ومغلقة</span>
          </div>
        </div>
      </div>

      {/* 3. Search and Filters */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-soft flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم الطالب، الصف، أو عنوان الكتاب..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-wathba-500 outline-none transition-all bg-white text-slate-700"
          >
            <option value="all">جميع الحالات</option>
            <option value="new">طلبات جديدة</option>
            <option value="waiting_for_pickup">بانتظار التسليم</option>
            <option value="under_inspection">قيد الفحص</option>
            <option value="completed">مكتملة ومغلقة</option>
            <option value="rejected">مرفوضة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>
      </div>

      {/* 4. Requests List */}
      <div className="space-y-4">
        {/* Returns Section */}
        {(activeTab === 'all' || activeTab === 'returns') && (
          <div className="space-y-3">
            {activeTab === 'all' && (
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-wathba-700" />
                <span>طلبات إرجاع الكتب المستعارة ({filteredReturns.length})</span>
              </h3>
            )}

            {filteredReturns.length === 0 && activeTab === 'returns' && (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-400 text-xs">
                لا توجد طلبات إرجاع مطابقة لمعايير البحث
              </div>
            )}

            {filteredReturns.map((req) => {
              const student = students.find((s) => s.id === req.studentId);
              const book = books.find((b) => b.id === req.bookId);
              const copy = copies.find((c) => c.id === req.copyId);
              const loan = loans.find((l) => l.id === req.loanId);

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-soft hover:shadow-card transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-wathba-50 text-wathba-800 flex items-center justify-center font-bold shrink-0 border border-wathba-100">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">
                            {student?.fullName || 'طالب'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-bold">
                            ({student?.grade} • {student?.groupName})
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            #{req.id.slice(-6)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>تاريخ التقديم: {formatUmmAlQuraDate(req.createdAt)} ({formatArabicDate(req.createdAt)})</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Book & Loan Info */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-12 rounded-xl bg-wathba-700 text-white flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-wathba-100" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-slate-900 truncate">
                          {book?.title || 'كتاب مستعار'}
                        </h4>
                        <span className="text-[11px] text-slate-500 block truncate">
                          رمز النسخة: <strong className="font-mono text-slate-700">{copy?.copyCode}</strong> • الرف: {copy?.shelfLocation}
                        </span>
                      </div>
                    </div>

                    <div className="text-left text-xs shrink-0">
                      <span className="text-slate-400 block text-[10px]">موعد الإرجاع المسجل:</span>
                      <strong className="font-bold text-slate-800">
                        {loan ? formatUmmAlQuraDate(loan.dueDate) : '-'}
                      </strong>
                    </div>
                  </div>

                  {/* Student Note */}
                  {req.studentNotes && (
                    <div className="text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700">ملاحظة الطالب:</span> {req.studentNotes}
                    </div>
                  )}

                  {/* Scheduled Pickup Time */}
                  {req.scheduledPickupTime && (
                    <div className="text-xs text-purple-900 bg-purple-50 p-2.5 rounded-xl border border-purple-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                      <span><strong>موعد التسليم المعتمد:</strong> {req.scheduledPickupTime}</span>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {req.status === 'rejected' && req.rejectionReason && (
                    <div className="text-xs text-rose-900 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span><strong>سبب الرفض:</strong> {req.rejectionReason}</span>
                    </div>
                  )}

                  {/* Workflow Action Buttons for Supervisor */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    {/* Stage 1: New -> Approve or Reject */}
                    {req.status === 'new' && (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            setSelectedReturnForAction({
                              request: req,
                              action: 'reject',
                            })
                          }
                          className="text-xs font-bold"
                        >
                          رفض الطلب
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setSelectedReturnForAction({
                              request: req,
                              action: 'approve',
                            })
                          }
                          className="text-xs font-bold bg-wathba-700 hover:bg-wathba-800 text-white"
                        >
                          الموافقة وتحديد موعد الاستلام
                        </Button>
                      </>
                    )}

                    {/* Stage 2: Approved / Waiting -> Receive Old Book & move to return shelf */}
                    {(req.status === 'approved' || req.status === 'waiting_for_pickup') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          setSelectedReturnForAction({
                            request: req,
                            action: 'receive',
                          })
                        }
                        className="text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white"
                      >
                        تأكيد استلام الكتاب ونقله لرف الفحص
                      </Button>
                    )}

                    {/* Stage 3: Under Inspection / Received -> Complete Inspection & Close Loan */}
                    {(req.status === 'under_inspection' || req.status === 'received') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          setSelectedReturnForAction({
                            request: req,
                            action: 'complete',
                          })
                        }
                        className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
                      >
                        اعتماد نتيجة الفحص وإغلاق الإعارة نهائياً
                      </Button>
                    )}

                    {req.status === 'completed' && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم الإرجاع وإغلاق عهدة الإعارة بنجاح</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Exchanges Section */}
        {(activeTab === 'all' || activeTab === 'exchanges') && (
          <div className="space-y-3 pt-4">
            {activeTab === 'all' && (
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
                <span>طلبات استبدال الكتب ({filteredExchanges.length})</span>
              </h3>
            )}

            {filteredExchanges.length === 0 && activeTab === 'exchanges' && (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-400 text-xs">
                لا توجد طلبات استبدال مطابقة لمعايير البحث
              </div>
            )}

            {filteredExchanges.map((req) => {
              const student = students.find((s) => s.id === req.studentId);
              const oldBook = books.find((b) => b.id === req.oldBookId);
              const oldCopy = copies.find((c) => c.id === req.oldCopyId);
              const newBook = books.find((b) => b.id === req.newBookId);

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-soft hover:shadow-card transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
                        <ArrowLeftRight className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900">
                            {student?.fullName || 'طالب'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-bold">
                            ({student?.grade} • {student?.groupName})
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            #{req.id.slice(-6)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>تاريخ التقديم: {formatUmmAlQuraDate(req.createdAt)} ({formatArabicDate(req.createdAt)})</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {renderStatusBadge(req.status)}
                    </div>
                  </div>

                  {/* Flow comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                      <div className="w-9 h-12 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4 text-slate-300" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full inline-block">
                          الكتاب المسترجع
                        </span>
                        <h5 className="font-bold text-xs text-slate-900 truncate mt-0.5">
                          {oldBook?.title}
                        </h5>
                        <span className="text-[10px] text-slate-400 block truncate">
                          نسخة: {oldCopy?.copyCode || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-wathba-50/70 border border-wathba-200 flex items-center gap-3">
                      <div className="w-9 h-12 rounded-xl bg-wathba-700 text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-wathba-100" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-wathba-800 bg-wathba-100 px-1.5 py-0.5 rounded-full inline-block">
                          الكتاب الجديد المطلوب ✨
                        </span>
                        <h5 className="font-bold text-xs text-wathba-900 truncate mt-0.5">
                          {newBook?.title}
                        </h5>
                        <span className="text-[10px] text-slate-500 block truncate">
                          المتاح بالمكتبة: {newBook?.availableCopiesCount} نسخة
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Student Note */}
                  {req.studentNotes && (
                    <div className="text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-700">ملاحظة الطالب:</span> {req.studentNotes}
                    </div>
                  )}

                  {/* Scheduled Pickup Time */}
                  {req.scheduledPickupTime && (
                    <div className="text-xs text-purple-900 bg-purple-50 p-2.5 rounded-xl border border-purple-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600 shrink-0" />
                      <span><strong>موعد الاستبدال المحدد:</strong> {req.scheduledPickupTime}</span>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {req.status === 'rejected' && req.rejectionReason && (
                    <div className="text-xs text-rose-900 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span><strong>سبب الرفض:</strong> {req.rejectionReason}</span>
                    </div>
                  )}

                  {/* Supervisor Actions */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    {/* Stage 1: New -> Approve with reserving copy or Reject */}
                    {req.status === 'new' && (
                      <>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            setSelectedExchangeForAction({
                              request: req,
                              action: 'reject',
                            })
                          }
                          className="text-xs font-bold"
                        >
                          رفض الطلب
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            setSelectedExchangeForAction({
                              request: req,
                              action: 'approve',
                            })
                          }
                          className="text-xs font-bold bg-wathba-700 hover:bg-wathba-800 text-white"
                        >
                          الموافقة وتجهيز النسخة البديلة
                        </Button>
                      </>
                    )}

                    {/* Stage 2: Waiting -> Receive Old Book & move to return shelf */}
                    {(req.status === 'approved' || req.status === 'waiting_for_old_book') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          setSelectedExchangeForAction({
                            request: req,
                            action: 'receive',
                          })
                        }
                        className="text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white"
                      >
                        تأكيد استلام الكتاب القديم وفحصه
                      </Button>
                    )}

                    {/* Stage 3: Received -> Complete Handover of New Book */}
                    {(req.status === 'old_book_received' || req.status === 'in_review') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          setSelectedExchangeForAction({
                            request: req,
                            action: 'complete',
                          })
                        }
                        className="text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
                      >
                        تسليم النسخة البديلة للطالب واعتماد الاستبدال
                      </Button>
                    )}

                    {req.status === 'completed' && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>اكتمل الاستبدال وتم تسليم النسخة الجديدة رسمياً</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Return Action Modal */}
      {selectedReturnForAction && (
        <Modal
          isOpen={!!selectedReturnForAction}
          onClose={() => setSelectedReturnForAction(null)}
          title={
            selectedReturnForAction.action === 'approve'
              ? 'الموافقة على طلب الإرجاع وتحديد موعد الاستلام'
              : selectedReturnForAction.action === 'reject'
              ? 'رفض طلب الإرجاع'
              : selectedReturnForAction.action === 'receive'
              ? 'تأكيد استلام الكتاب من الطالب ونقله لرف الفحص'
              : 'اعتماد نتيجة فحص الكتاب وإغلاق الإعارة'
          }
          subtitle={`طلب إرجاع #${selectedReturnForAction.request.id.slice(-6)}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-right">
            {selectedReturnForAction.action === 'approve' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  حدد موعد أو تعليمات التسليم للطالب:
                </label>
                <input
                  type="text"
                  value={pickupTimeInput}
                  onChange={(e) => setPickupTimeInput(e.target.value)}
                  placeholder="مثال: يرجى تسليم الكتاب غداً في الفسحة المدرسية لمشرف الصالة..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 outline-none"
                />
              </div>
            )}

            {selectedReturnForAction.action === 'reject' && (
              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1.5">
                  سبب رفض طلب الإرجاع (إلزامي):
                </label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  rows={3}
                  placeholder="مثال: الكتاب مطلوب مراجعته أولاً أو هناك التزام سابق..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            )}

            {(selectedReturnForAction.action === 'receive' || selectedReturnForAction.action === 'complete') && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-wathba-50 border border-wathba-200 text-xs text-wathba-900">
                  <ShieldCheck className="w-4 h-4 text-wathba-700 inline ml-1.5" />
                  سيتم تسجيل حالة النسخة على رف الإرجاع وتحديث عهدة الطالب فور الاعتماد.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تقييم حالة النسخة عند الفحص:
                  </label>
                  <select
                    value={conditionRatingInput}
                    onChange={(e) => setConditionRatingInput(e.target.value as ConditionRating)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-wathba-500 outline-none bg-white"
                  >
                    <option value="pristine">ممتاز وجديد كالأصل</option>
                    <option value="good">سليم وجيد جداً</option>
                    <option value="needs_monitoring">يحتاج متابعة وتغليف بسيط</option>
                    <option value="damaged">متضرر (تمزق أو حبر)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظات الفحص:
                  </label>
                  <input
                    type="text"
                    value={inspectionNotesInput}
                    onChange={(e) => setInspectionNotesInput(e.target.value)}
                    placeholder="ملاحظات المشرف حول سلامة الغلاف والصفحات..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSelectedReturnForAction(null)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleExecuteReturnAction}
                className="text-xs font-bold bg-wathba-700 hover:bg-wathba-800 text-white"
              >
                تأكيد الإجراء
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Exchange Action Modal */}
      {selectedExchangeForAction && (
        <Modal
          isOpen={!!selectedExchangeForAction}
          onClose={() => setSelectedExchangeForAction(null)}
          title={
            selectedExchangeForAction.action === 'approve'
              ? 'الموافقة على طلب الاستبدال وتجهيز النسخة البديلة'
              : selectedExchangeForAction.action === 'reject'
              ? 'رفض طلب الاستبدال'
              : selectedExchangeForAction.action === 'receive'
              ? 'استلام وفحص الكتاب القديم'
              : 'تسليم النسخة البديلة واعتماد الاستبدال النهائي'
          }
          subtitle={`طلب استبدال #${selectedExchangeForAction.request.id.slice(-6)}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-right">
            {selectedExchangeForAction.action === 'approve' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    اختر النسخة الورقية المحددة من الكتاب الجديد لحجزها:
                  </label>
                  <select
                    value={assignedCopyIdInput}
                    onChange={(e) => setAssignedCopyIdInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-wathba-500 outline-none bg-white"
                  >
                    <option value="">تخصيص تلقائي لأول نسخة متاحة</option>
                    {copies
                      .filter(
                        (c) =>
                          c.bookId === selectedExchangeForAction.request.newBookId &&
                          c.status === 'available'
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          نسخة: {c.copyCode} (الرف: {c.shelfLocation})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تعليمات أو موعد الاستبدال للطالب:
                  </label>
                  <input
                    type="text"
                    value={pickupTimeInput}
                    onChange={(e) => setPickupTimeInput(e.target.value)}
                    placeholder="مثال: تفضل بزيارة المكتبة مع كتابك القديم في الفسحة المدرسية..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 outline-none"
                  />
                </div>
              </div>
            )}

            {selectedExchangeForAction.action === 'reject' && (
              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1.5">
                  سبب رفض طلب الاستبدال (إلزامي):
                </label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  rows={3}
                  placeholder="مثال: النسخة البديلة محجوزة أو غير متاحة للإعارة حالياً..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            )}

            {(selectedExchangeForAction.action === 'receive' || selectedExchangeForAction.action === 'complete') && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-wathba-50 border border-wathba-200 text-xs text-wathba-900">
                  <ShieldCheck className="w-4 h-4 text-wathba-700 inline ml-1.5" />
                  تسليم النسخة الجديدة سيغلق تلقائياً إعارة الكتاب القديم وينشئ إعارة رسمية جديدة للطالب.
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    فحص الكتاب القديم المسترجع:
                  </label>
                  <select
                    value={conditionRatingInput}
                    onChange={(e) => setConditionRatingInput(e.target.value as ConditionRating)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-wathba-500 outline-none bg-white"
                  >
                    <option value="pristine">ممتاز وجديد كالأصل</option>
                    <option value="good">سليم وجيد جداً</option>
                    <option value="needs_monitoring">يحتاج متابعة وتغليف بسيط</option>
                    <option value="damaged">متضرر</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ملاحظات:
                  </label>
                  <input
                    type="text"
                    value={inspectionNotesInput}
                    onChange={(e) => setInspectionNotesInput(e.target.value)}
                    placeholder="ملاحظات حول عملية الاستبدال والنسخة المسلمة..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-wathba-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSelectedExchangeForAction(null)}
                className="text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleExecuteExchangeAction}
                className="text-xs font-bold bg-wathba-700 hover:bg-wathba-800 text-white"
              >
                تأكيد الإجراء
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
