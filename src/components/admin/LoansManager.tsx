import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Loan } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { DirectCheckoutModal } from '../supervisor/DirectCheckoutModal';
import { DirectReturnModal } from '../supervisor/DirectReturnModal';
import { QRScannerModal } from '../qr/QRScannerModal';
import { ReturnShelfView } from '../supervisor/ReturnShelfView';
import { formatArabicDate, isOverdue, getDaysRemaining, formatUmmAlQuraDate, getLoanCountdown } from '../../lib/dateUtils';
import { exportToExcel } from '../../lib/exportUtils';
import {
  RotateCcw,
  BookOpen,
  QrCode,
  Download,
  Search,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  MessageSquare,
  FileText,
} from 'lucide-react';

export interface LoansManagerProps {
  initialSubTab?: 'active' | 'overdue' | 'history' | 'shelf' | 'completions';
}

export const LoansManager: React.FC<LoansManagerProps> = ({ initialSubTab = 'active' }) => {
  const {
    loans,
    copies,
    books,
    students,
    staff,
    readingCompletions = [],
    approveReadingCompletion,
    rejectReadingCompletion,
  } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<'active' | 'overdue' | 'history' | 'shelf' | 'completions'>(initialSubTab);

  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);
  const [searchTerm, setSearchTerm] = useState('');

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [preSelectedLoanId, setPreSelectedLoanId] = useState<string | undefined>(undefined);

  const supervisorId = currentStaff?.id || 'staff-admin-1';
  const supervisorName = currentStaff?.fullName || 'مشرف المكتبة';

  const [completionsFilter, setCompletionsFilter] = useState<'all' | 'pending_approval' | 'approved' | 'rejected'>('all');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedCompletionId, setSelectedCompletionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const pendingCompletionsCount = (readingCompletions || []).filter(
    (c) => c.status === 'pending_approval'
  ).length;

  const handleApproveCompletion = (id: string) => {
    const res = approveReadingCompletion({
      completionId: id,
      staffId: supervisorId,
      staffName: supervisorName,
    });
    if (res.success) {
      showToast('تم اعتماد إكمال قراءة الكتاب وإضافته لسجل إنجازات الطالب بنجاح', 'success');
    } else {
      showToast(res.error || 'حدث خطأ أثناء اعتماد الإكمال', 'error');
    }
  };

  const handleOpenReject = (id: string) => {
    setSelectedCompletionId(id);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!selectedCompletionId) return;
    if (!rejectionReason.trim()) {
      showToast('يرجى كتابة سبب الإعادة أو التوضيح للطالب', 'error');
      return;
    }
    const res = rejectReadingCompletion({
      completionId: selectedCompletionId,
      staffId: supervisorId,
      staffName: supervisorName,
      reason: rejectionReason.trim(),
    });
    if (res.success) {
      showToast('تمت إعادة الطلب للطالب مع التوضيح المطلوب', 'info');
      setRejectModalOpen(false);
      setSelectedCompletionId(null);
      setRejectionReason('');
    } else {
      showToast(res.error || 'حدث خطأ أثناء تحديث حالة الطلب', 'error');
    }
  };

  // Filters
  const activeLoans = loans.filter((l) => l.status === 'active');
  const overdueLoans = activeLoans.filter((l) => isOverdue(l.dueDate));
  const returnedLoans = loans.filter((l) => l.status === 'returned');

  const currentList =
    activeSubTab === 'active'
      ? activeLoans
      : activeSubTab === 'overdue'
      ? overdueLoans
      : returnedLoans;

  const filteredLoans = currentList.filter((loan) => {
    const copy = copies.find((c) => c.id === loan.copyId);
    const book = books.find((b) => b.id === copy?.bookId);
    const student = students.find((s) => s.id === loan.studentId);

    const term = searchTerm.toLowerCase().trim();
    return (
      (copy && copy.copyCode.toLowerCase().includes(term)) ||
      (book && book.title.toLowerCase().includes(term)) ||
      (student && student.fullName.toLowerCase().includes(term)) ||
      (student && student.internalId.toLowerCase().includes(term))
    );
  });

  const filteredCompletions = (readingCompletions || []).filter((comp) => {
    if (completionsFilter !== 'all' && comp.status !== completionsFilter) return false;
    const b = books.find((x) => x.id === comp.bookId);
    const s = students.find((x) => x.id === comp.studentId);
    const c = copies.find((x) => x.id === comp.copyId);
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (b && b.title.toLowerCase().includes(term)) ||
      (b && b.author.toLowerCase().includes(term)) ||
      (s && s.fullName.toLowerCase().includes(term)) ||
      (s && s.internalId.toLowerCase().includes(term)) ||
      (c && c.copyCode.toLowerCase().includes(term))
    );
  });

  const handleOpenReturnForLoan = (loanId: string) => {
    setPreSelectedLoanId(loanId);
    setReturnModalOpen(true);
  };

  const handleExportExcel = () => {
    const data = filteredLoans.map((l) => {
      const c = copies.find((cp) => cp.id === l.copyId);
      const b = books.find((bk) => bk.id === c?.bookId);
      const s = students.find((st) => st.id === l.studentId);
      return {
        'رقم الإعارة': l.id,
        'رمز النسخة': c?.copyCode || '-',
        'عنوان الكتاب': b?.title || '-',
        'اسم الطالب': s?.fullName || '-',
        'الصف': s?.grade || '-',
        'المجموعة': s?.groupName || '-',
        'تاريخ التسليم': `${formatUmmAlQuraDate(l.loanDate)} (${formatArabicDate(l.loanDate)})`,
        'موعد الإرجاع': `${formatUmmAlQuraDate(l.dueDate)} (${formatArabicDate(l.dueDate)})`,
        'حالة العد التنازلي': getLoanCountdown(l.dueDate).label,
        'تاريخ الإعادة الفعلي': l.returnDate ? `${formatUmmAlQuraDate(l.returnDate)} (${formatArabicDate(l.returnDate)})` : '-',
        'الحالة': l.status,
      };
    });
    exportToExcel(data, `سجل_الإعارات_${activeSubTab}`);
    showToast('تم تصدير كشف الإعارات إلى Excel', 'success');
  };

  if (activeSubTab === 'shelf') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setActiveSubTab('active')}
          className="text-xs text-wathba-700 font-bold flex items-center gap-1 hover:underline"
        >
          <ArrowRight className="w-4 h-4" /> العودة لإدارة الإعارات
        </button>
        <ReturnShelfView />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-royal-100 text-royal-800">
              <RotateCcw className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              إدارة الإعارات والاسترجاع الميداني
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            توثيق تسليم الكتب للطلاب، استرجاع النسخ، تتبع المواعيد المحددة لمنع التأخير، وحماية مقتنيات المكتبة.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="gold"
            size="sm"
            icon={<QrCode className="w-4 h-4 text-slate-900" />}
            onClick={() => setScannerOpen(true)}
          >
            المسح بالكاميرا 📷
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<BookOpen className="w-4 h-4" />}
            onClick={() => setCheckoutModalOpen(true)}
          >
            تسليم كتاب جديد
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => {
              setPreSelectedLoanId(undefined);
              setReturnModalOpen(true);
            }}
          >
            استرجاع كتاب
          </Button>
        </div>
      </div>

      {/* Sub-tabs Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 bg-[#f6f8fa] p-1.5 rounded-2xl border border-[#e3ecf3] text-xs overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveSubTab('active')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeSubTab === 'active'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الإعارات النشطة ({activeLoans.length})
          </button>
          <button
            onClick={() => setActiveSubTab('overdue')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeSubTab === 'overdue'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكتب المتأخرة ({overdueLoans.length})
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeSubTab === 'history'
                ? 'bg-[#3b707d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سجل الكتب المعادة ({returnedLoans.length})
          </button>
          <button
            onClick={() => setActiveSubTab('completions')}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubTab === 'completions'
                ? 'bg-[#1c353d] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            طلبات إكمال القراءة
            {pendingCompletionsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                {pendingCompletionsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('shelf')}
            className="min-h-[40px] px-3.5 py-2 rounded-xl font-bold text-orange-700 hover:bg-orange-50 whitespace-nowrap transition-all flex items-center gap-1"
          >
            <Layers className="w-3.5 h-3.5" />
            رف الإرجاع والفحص
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="w-4 h-4" />}
          onClick={handleExportExcel}
          className="w-full sm:w-auto"
        >
          تصدير Excel
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e3ecf3] shadow-soft flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث برمز النسخة (WTH-125-001) أو عنوان الكتاب أو اسم الطالب..."
            className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
          />
        </div>
        <span className="text-[#3b707d] font-black bg-[#e3ecf3]/60 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          {activeSubTab === 'completions' ? `${filteredCompletions.length} طلب` : `${filteredLoans.length} سجل`}
        </span>
      </div>

      {/* Completions Management View */}
      {activeSubTab === 'completions' ? (
        <div className="space-y-4">
          {/* Sub Filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'جميع الطلبات', count: readingCompletions.length },
              { id: 'pending_approval', label: 'بانتظار الاعتماد', count: pendingCompletionsCount, highlight: true },
              { id: 'approved', label: 'المعتمدة', count: readingCompletions.filter((c) => c.status === 'approved').length },
              { id: 'rejected', label: 'المعادة للتوضيح', count: readingCompletions.filter((c) => c.status === 'rejected').length },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setCompletionsFilter(f.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  completionsFilter === f.id
                    ? 'bg-[#1c353d] text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-[#dde6ed] hover:bg-slate-50'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    completionsFilter === f.id
                      ? 'bg-white/20 text-white'
                      : f.highlight && f.count > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Completions List */}
          {filteredCompletions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-[#e3ecf3] p-12 text-center text-slate-400 text-xs shadow-soft space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600 text-sm">لا توجد طلبات إكمال قراءة في هذا القسم</p>
              <p className="text-[11px] text-slate-400">ستظهر هنا طلبات الطلاب فور تأكيدهم إتمام قراءة الكتب المستعارة</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCompletions.map((comp) => {
                const book = books.find((b) => b.id === comp.bookId);
                const student = students.find((s) => s.id === comp.studentId);
                const copy = copies.find((c) => c.id === comp.copyId);
                const loan = loans.find((l) => l.id === comp.loanId);

                return (
                  <div
                    key={comp.id}
                    className={`bg-white rounded-2xl border p-5 shadow-soft space-y-4 transition-all ${
                      comp.status === 'pending_approval'
                        ? 'border-amber-300/80 bg-amber-50/15'
                        : comp.status === 'approved'
                        ? 'border-emerald-200'
                        : 'border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-black text-sm text-slate-900 leading-snug">{book?.title || 'كتاب غير معروف'}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">{book?.author}</p>
                        {copy && (
                          <span className="font-mono text-[10px] text-slate-400 mt-0.5 block">
                            رمز النسخة: <strong className="text-[#3b707d]">{copy.copyCode}</strong>
                          </span>
                        )}
                      </div>
                      <div>
                        {comp.status === 'pending_approval' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3" />
                            بانتظار الاعتماد
                          </span>
                        )}
                        {comp.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            معتمد مكتمل
                          </span>
                        )}
                        {comp.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3 h-3" />
                            أُعيد للتوضيح
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#f6f8fa] rounded-xl p-3 border border-[#e3ecf3]/70 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">اسم الطالب</span>
                        <span className="font-bold text-slate-900 block truncate">{student?.fullName || comp.studentId}</span>
                        <span className="text-[10px] text-slate-500">
                          {student?.grade} • {student?.groupName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">تاريخ طلب الإكمال</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">
                          {formatArabicDate(comp.requestDate)}
                        </span>
                        {loan && (
                          <span className="text-[10px] text-slate-400 block font-mono">
                            استُعير: {formatArabicDate(loan.loanDate)}
                          </span>
                        )}
                      </div>

                      {comp.status === 'approved' && (
                        <div className="col-span-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">المشرف المعتمد: <strong className="text-slate-800">{comp.approvedByStaffName || 'إدارة المكتبة'}</strong></span>
                          <span className="text-slate-400 font-mono">{comp.approvedAt ? formatArabicDate(comp.approvedAt) : ''}</span>
                        </div>
                      )}

                      {comp.status === 'rejected' && comp.rejectionReason && (
                        <div className="col-span-2 pt-2 border-t border-rose-200 text-[11px] text-rose-800 bg-rose-50/50 p-2 rounded-lg">
                          <strong className="block text-[10px] text-rose-600">سبب الإعادة / ملاحظة المشرف:</strong>
                          {comp.rejectionReason}
                        </div>
                      )}
                    </div>

                    {comp.studentNotes && (
                      <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-700">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#3b707d] mb-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>انطباع وفوائد الطالب:</span>
                        </div>
                        <p className="italic leading-relaxed">"{comp.studentNotes}"</p>
                      </div>
                    )}

                    {/* Action buttons if pending */}
                    {comp.status === 'pending_approval' && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleApproveCompletion(comp.id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>اعتماد إكمال القراءة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReject(comp.id)}
                          className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors border border-slate-200"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>إعادة للتوضيح</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {filteredLoans.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#e3ecf3] p-10 text-center text-slate-400 text-xs shadow-soft">
            لا توجد سجلات مطابقة في هذا القسم
          </div>
        ) : (
          filteredLoans.map((loan) => {
            const copy = copies.find((c) => c.id === loan.copyId);
            const book = books.find((b) => b.id === copy?.bookId);
            const student = students.find((s) => s.id === loan.studentId);
            const late = isOverdue(loan.dueDate);
            const cd = loan.status === 'active' ? getLoanCountdown(loan.dueDate) : null;

            return (
              <div
                key={loan.id}
                className={`bg-white rounded-2xl border p-4 shadow-soft space-y-3 ${
                  late && loan.status === 'active' ? 'border-rose-200 bg-rose-50/20' : 'border-[#e3ecf3]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-sm text-slate-900 leading-snug">{book?.title}</div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                      رمز النسخة: <strong className="text-[#3b707d]">{copy?.copyCode}</strong>
                    </div>
                    {(() => {
                      const comp = readingCompletions.find((c) => c.loanId === loan.id);
                      if (!comp) return null;
                      if (comp.status === 'approved') {
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> أتم قراءة الكتاب
                          </span>
                        );
                      }
                      if (comp.status === 'pending_approval') {
                        return (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 mt-1 animate-pulse">
                            <Clock className="w-2.5 h-2.5" /> بانتظار اعتماد الإكمال
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <Badge
                    status={late && loan.status === 'active' ? 'overdue' : loan.status}
                    size="sm"
                  />
                </div>

                <div className="bg-[#f6f8fa] rounded-xl p-3 border border-[#e3ecf3]/70 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">الطالب المستعير</span>
                    <span className="font-bold text-slate-900 block truncate">{student?.fullName}</span>
                    <span className="text-[10px] text-slate-500">
                      {student?.grade} • {student?.groupName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">تاريخ التسليم</span>
                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {formatArabicDate(loan.loanDate)}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 block">
                      {loan.status === 'active' ? 'موعد الإرجاع:' : 'تاريخ الإرجاع الفعلي:'}
                    </span>
                    {cd ? (
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="font-bold text-slate-900">{cd.hijriDate}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cd.badgeColorClass}`}>
                          {cd.label}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-slate-800">{formatUmmAlQuraDate(loan.returnDate)}</span>
                        <span className="font-mono text-[10px] text-slate-400">({formatArabicDate(loan.returnDate)})</span>
                      </div>
                    )}
                  </div>
                </div>

                {loan.status === 'active' && (
                  <Button
                    variant="primary"
                    size="md"
                    icon={<RotateCcw className="w-4 h-4" />}
                    onClick={() => handleOpenReturnForLoan(loan.id)}
                    className="w-full"
                  >
                    استرجاع وفحص الكتاب
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Loans Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#e3ecf3] overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#f6f8fa] text-slate-700 font-bold border-b border-[#e3ecf3]">
              <tr>
                <th className="p-4">النسخة والكتاب</th>
                <th className="p-4">الطالب المستعير</th>
                <th className="p-4">تاريخ التسليم</th>
                <th className="p-4">موعد الإرجاع</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    لا توجد سجلات مطابقة في هذا القسم
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => {
                  const copy = copies.find((c) => c.id === loan.copyId);
                  const book = books.find((b) => b.id === copy?.bookId);
                  const student = students.find((s) => s.id === loan.studentId);
                  const late = isOverdue(loan.dueDate);

                  return (
                    <tr key={loan.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{book?.title}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          رمز النسخة: <strong>{copy?.copyCode}</strong>
                        </div>
                        {(() => {
                          const comp = readingCompletions.find((c) => c.loanId === loan.id);
                          if (!comp) return null;
                          if (comp.status === 'approved') {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 mt-1">
                                <CheckCircle2 className="w-2.5 h-2.5" /> أتم قراءة الكتاب
                              </span>
                            );
                          }
                          if (comp.status === 'pending_approval') {
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 mt-1 animate-pulse">
                                <Clock className="w-2.5 h-2.5" /> بانتظار اعتماد الإكمال
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{student?.fullName}</div>
                        <span className="text-slate-400 block text-[11px]">
                          {student?.grade} • {student?.groupName}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {formatArabicDate(loan.loanDate)}
                      </td>
                      <td className="p-4">
                        {loan.status === 'active' ? (
                          (() => {
                            const cd = getLoanCountdown(loan.dueDate);
                            return (
                              <div className="space-y-1">
                                <span className="font-bold text-slate-900 block text-xs">
                                  {cd.hijriDate}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cd.badgeColorClass}`}>
                                    {cd.label}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ({cd.gregorianDate})
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-slate-500 text-[11px]">
                            <span className="font-bold block text-slate-800">{formatUmmAlQuraDate(loan.returnDate)}</span>
                            <span className="font-mono text-[10px] text-slate-400">({formatArabicDate(loan.returnDate)})</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge
                          status={late && loan.status === 'active' ? 'overdue' : loan.status}
                          size="sm"
                        />
                      </td>
                      <td className="p-4 text-center">
                        {loan.status === 'active' && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            onClick={() => handleOpenReturnForLoan(loan.id)}
                          >
                            استرجاع وفحص
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Rejection / Clarification Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">إعادة طلب إكمال القراءة للتوضيح</h3>
                <p className="text-xs text-slate-500">سيتم إشعار الطالب بالملاحظات لإعادة المحاولة أو تقديم المطلوب</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سبب الإعادة / ملاحظة المشرف للطالب <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="مثال: يرجى كتابة ملخص قصير عن الأفكار الرئيسية في الكتاب أو مناقشة المشرف أولاً..."
                className="w-full h-28 p-3 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedCompletionId(null);
                  setRejectionReason('');
                }}
              >
                إلغاء
              </Button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-sm"
              >
                تأكيد وإرسال للطالب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {checkoutModalOpen && (
        <DirectCheckoutModal
          isOpen={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          supervisorId={supervisorId}
        />
      )}

      {returnModalOpen && (
        <DirectReturnModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          supervisorId={supervisorId}
          preSelectedLoanId={preSelectedLoanId}
        />
      )}

      {scannerOpen && (
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          initialMode="checkout"
          onScanSuccess={(code, mode) => {
            if (mode === 'return') setReturnModalOpen(true);
            else setCheckoutModalOpen(true);
          }}
        />
      )}
    </div>
  );
};
