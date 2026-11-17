import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { BookReadingCompletion, ReadingCompletionStatus } from '../../types';
import { formatArabicDateTime } from '../../lib/dateUtils';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  BookOpen,
  Users,
  Layers,
  Calendar,
  ChevronDown,
  Check,
  RotateCcw,
  ShieldCheck,
  FileCheck,
  Sparkles,
  ArrowRight,
  MessageSquare,
  HelpCircle,
  Tag,
  Hash,
  Award,
} from 'lucide-react';

export const ReadingCompletionsManagerView: React.FC = () => {
  const { currentStaff } = useAuth();
  const {
    staff,
    students,
    books,
    copies,
    loans,
    readingCompletions,
    approveReadingCompletion,
    setReadingCompletionUnderReview,
    returnReadingCompletionForRevision,
    rejectReadingCompletion,
    updateReadingCompletionAdminNotes,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReadingCompletionStatus>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Selected completion for details modal
  const [selectedCompletion, setSelectedCompletion] = useState<BookReadingCompletion | null>(null);

  // Action Modals State
  const [actionType, setActionType] = useState<'approve' | 'review' | 'return' | 'reject' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [adminNotesInput, setAdminNotesInput] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Group list
  const allGroups = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.groupName).filter(Boolean)));
  }, [students]);

  // Supervisors list
  const allSupervisors = useMemo(() => {
    return staff.filter((s) => s.status === 'active');
  }, [staff]);

  // Scoped students if not admin
  const allowedStudentIds = useMemo(() => {
    if (isAdmin) return null;
    const myGroups = liveStaff?.assignedGroups || [];
    if (myGroups.length === 0) return null; // sees all if unassigned
    return new Set(students.filter((s) => myGroups.includes(s.groupName)).map((s) => s.id));
  }, [isAdmin, liveStaff, students]);

  // Filtered completions list
  const filteredCompletions = useMemo(() => {
    return (readingCompletions || []).filter((comp) => {
      // Scope check
      if (allowedStudentIds && !allowedStudentIds.has(comp.studentId)) {
        return false;
      }

      const student = students.find((s) => s.id === comp.studentId);
      const book = books.find((b) => b.id === comp.bookId);

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'new') {
          if (comp.status !== 'new' && comp.status !== 'pending_approval') return false;
        } else if (comp.status !== statusFilter) {
          return false;
        }
      }

      // Group Filter
      if (groupFilter !== 'all' && student?.groupName !== groupFilter) {
        return false;
      }

      // Supervisor Filter
      if (supervisorFilter !== 'all') {
        const loan = loans.find((l) => l.id === comp.loanId);
        if (loan?.supervisorId !== supervisorFilter && comp.approvedByStaffId !== supervisorFilter) {
          return false;
        }
      }

      // Period Filter
      if (periodFilter !== 'all') {
        const reqDate = new Date(comp.requestDate || comp.createdAt).getTime();
        const now = Date.now();
        if (periodFilter === 'today') {
          const oneDayAgo = now - 24 * 3600 * 1000;
          if (reqDate < oneDayAgo) return false;
        } else if (periodFilter === 'week') {
          const oneWeekAgo = now - 7 * 24 * 3600 * 1000;
          if (reqDate < oneWeekAgo) return false;
        } else if (periodFilter === 'month') {
          const oneMonthAgo = now - 30 * 24 * 3600 * 1000;
          if (reqDate < oneMonthAgo) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchStudent = (student?.fullName || '').toLowerCase().includes(q) || (student?.internalId || '').toLowerCase().includes(q);
        const matchBook = (book?.title || '').toLowerCase().includes(q) || (book?.code || '').toLowerCase().includes(q) || (book?.author || '').toLowerCase().includes(q);
        const matchNotes = (comp.studentNotes || '').toLowerCase().includes(q);
        return matchStudent || matchBook || matchNotes;
      }

      return true;
    }).sort((a, b) => new Date(b.requestDate || b.createdAt).getTime() - new Date(a.requestDate || a.createdAt).getTime());
  }, [readingCompletions, allowedStudentIds, students, books, statusFilter, groupFilter, supervisorFilter, periodFilter, searchQuery, loans]);

  // Statistics
  const stats = useMemo(() => {
    const list = readingCompletions || [];
    const scopedList = allowedStudentIds ? list.filter((c) => allowedStudentIds.has(c.studentId)) : list;
    const total = scopedList.length;
    const newCount = scopedList.filter((c) => c.status === 'new' || c.status === 'pending_approval').length;
    const underReviewCount = scopedList.filter((c) => c.status === 'under_review').length;
    const approvedCount = scopedList.filter((c) => c.status === 'approved').length;
    const needsRevisionCount = scopedList.filter((c) => c.status === 'needs_revision').length;
    const rejectedCount = scopedList.filter((c) => c.status === 'rejected').length;

    return { total, newCount, underReviewCount, approvedCount, needsRevisionCount, rejectedCount };
  }, [readingCompletions, allowedStudentIds]);

  // الاعتماد المباشر الفوري بضغطة زر واحدة دون نوافذ إضافية أو رجوع للخلف
  const handleConfirmDirectApprove = (comp: BookReadingCompletion) => {
    if (!liveStaff) return;
    setIsSubmittingAction(true);

    try {
      const res = approveReadingCompletion({
        completionId: comp.id,
        staffId: liveStaff.id,
        staffName: liveStaff.fullName,
        adminNotes: adminNotesInput || comp.adminNotes,
      });
      if (res.success) {
        showToast('تم اعتماد إكمال قراءة الكتاب وإضافته لسجل قراءات الطالب بنجاح! ✅', 'success');
        setSelectedCompletion((prev) =>
          prev && prev.id === comp.id
            ? {
                ...prev,
                status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedByStaffName: liveStaff.fullName,
                approvedByStaffId: liveStaff.id,
              }
            : prev
        );
        setActionType(null);
      } else {
        showToast(res.error || 'تعذر اعتماد الطلب', 'error');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // وضع قيد المراجعة المباشر
  const handleConfirmDirectReview = (comp: BookReadingCompletion) => {
    if (!liveStaff) return;
    setIsSubmittingAction(true);

    try {
      const res = setReadingCompletionUnderReview({
        completionId: comp.id,
        staffId: liveStaff.id,
        staffName: liveStaff.fullName,
      });
      if (res.success) {
        showToast('تم وضع الطلب قيد المراجعة الإدارية ⏱️', 'info');
        setSelectedCompletion((prev) =>
          prev && prev.id === comp.id
            ? {
                ...prev,
                status: 'under_review',
                reviewedAt: new Date().toISOString(),
                reviewedByStaffName: liveStaff.fullName,
                reviewedByStaffId: liveStaff.id,
              }
            : prev
        );
        setActionType(null);
      } else {
        showToast(res.error || 'تعذر تحديث حالة الطلب', 'error');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Open Action Modal / Inline Box
  const handleOpenAction = (type: 'approve' | 'review' | 'return' | 'reject', comp: BookReadingCompletion) => {
    if (type === 'approve') {
      handleConfirmDirectApprove(comp);
      return;
    }
    if (type === 'review') {
      handleConfirmDirectReview(comp);
      return;
    }
    setSelectedCompletion(comp);
    setActionType(type);
    setActionReason('');
    setAdminNotesInput(comp.adminNotes || '');
  };

  // Submit Action (لطلبات الإعادة أو الرفض التي تتطلب سبباً موثقاً)
  const handleConfirmAction = () => {
    if (!selectedCompletion || !liveStaff || !actionType) return;
    setIsSubmittingAction(true);

    try {
      if (actionType === 'approve') {
        handleConfirmDirectApprove(selectedCompletion);
      } else if (actionType === 'review') {
        handleConfirmDirectReview(selectedCompletion);
      } else if (actionType === 'return') {
        if (!actionReason.trim()) {
          showToast('يرجى كتابة سبب إعادة الطلب للطالب للاستكمال', 'warning');
          return;
        }
        const res = returnReadingCompletionForRevision({
          completionId: selectedCompletion.id,
          staffId: liveStaff.id,
          staffName: liveStaff.fullName,
          reason: actionReason,
          adminNotes: adminNotesInput,
        });
        if (res.success) {
          showToast('تمت إعادة الطلب للطالب لاستكمال المعلومات وإشعاره بالملاحظات ℹ️', 'info');
          setSelectedCompletion((prev) =>
            prev && prev.id === selectedCompletion.id
              ? {
                  ...prev,
                  status: 'needs_revision',
                  revisionReason: actionReason,
                }
              : prev
          );
          setActionType(null);
          setActionReason('');
        } else {
          showToast(res.error || 'تعذر إعادة الطلب', 'error');
        }
      } else if (actionType === 'reject') {
        if (!actionReason.trim()) {
          showToast('يرجى كتابة سبب رفض الطلب', 'warning');
          return;
        }
        const res = rejectReadingCompletion({
          completionId: selectedCompletion.id,
          staffId: liveStaff.id,
          staffName: liveStaff.fullName,
          reason: actionReason,
          adminNotes: adminNotesInput,
        });
        if (res.success) {
          showToast('تم رفض طلب إكمال القراءة وحفظ السجل ❌', 'info');
          setSelectedCompletion((prev) =>
            prev && prev.id === selectedCompletion.id
              ? {
                  ...prev,
                  status: 'rejected',
                  rejectionReason: actionReason,
                }
              : prev
          );
          setActionType(null);
          setActionReason('');
        } else {
          showToast(res.error || 'تعذر رفض الطلب', 'error');
        }
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: ReadingCompletionStatus) => {
    switch (status) {
      case 'new':
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-sky-50 text-sky-800 border border-sky-200">
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
            طلب جديد
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />
            قيد المراجعة
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            معتمد
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            يحتاج استكمال
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            مرفوض
          </span>
        );
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (filteredCompletions.length === 0) {
      showToast('لا توجد بيانات متاحة للتصدير حالياً.', 'warning');
      return;
    }

    const headers = [
      'اسم الطالب',
      'معرف الطالب',
      'المجموعة',
      'عنوان الكتاب',
      'المؤلف',
      'تاريخ الاستعارة',
      'تاريخ تقديم الإكمال',
      'حالة الطلب',
      'المسؤول المعتمد',
      'تاريخ الاعتماد',
      'ملاحظات الطالب',
      'الملاحظات الإدارية',
    ];

    const rows = filteredCompletions.map((comp) => {
      const student = students.find((s) => s.id === comp.studentId);
      const book = books.find((b) => b.id === comp.bookId);
      const loan = loans.find((l) => l.id === comp.loanId);

      const statusMap: Record<string, string> = {
        new: 'جديد',
        pending_approval: 'جديد',
        under_review: 'قيد المراجعة',
        approved: 'معتمد',
        needs_revision: 'يحتاج استكمال',
        rejected: 'مرفوض',
      };

      return [
        `"${student?.fullName || '-'}"`,
        `"${student?.internalId || '-'}"`,
        `"${student?.groupName || 'عام'}"`,
        `"${book?.title || '-'}"`,
        `"${book?.author || '-'}"`,
        `"${loan ? new Date(loan.loanDate).toLocaleDateString('ar-SA') : '-'}"`,
        `"${new Date(comp.requestDate || comp.createdAt).toLocaleDateString('ar-SA')}"`,
        `"${statusMap[comp.status] || comp.status}"`,
        `"${comp.approvedByStaffName || '-'}"`,
        `"${comp.approvedAt ? new Date(comp.approvedAt).toLocaleDateString('ar-SA') : '-'}"`,
        `"${(comp.studentNotes || '').replace(/"/g, '""')}"`,
        `"${(comp.adminNotes || comp.revisionReason || comp.rejectionReason || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `طلبات_إكمال_الكتب_مكتبة_مداد_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير ملف الإكسل بنجاح!', 'success');
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#3b707d] to-[#2c5661] text-white shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1c353d]">طلبات إكمال الكتب</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة وتدقيق طلبات إتمام قراءة الكتب المقدمة من الطلاب واعتمادها في السجلات الرسمية
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportCSV}
          >
            تصدير إكسل
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            طباعة
          </Button>
        </div>
      </div>

      {/* 1. لوحة إحصائية مختصرة للطلبات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* إجمالي الطلبات */}
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-[#1c353d] text-white border-[#1c353d] shadow-sm'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 opacity-80">
            <span className="font-bold">إجمالي الطلبات</span>
            <FileCheck className="w-4 h-4" />
          </div>
          <span className="text-2xl font-black block">{stats.total}</span>
          <span className="text-[10px] opacity-75">جميع طلبات الإكمال المسجلة</span>
        </button>

        {/* الطلبات الجديدة */}
        <button
          type="button"
          onClick={() => setStatusFilter('new')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'new'
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : 'bg-white hover:bg-sky-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 opacity-80">
            <span className="font-bold">طلبات جديدة</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse"></span>
          </div>
          <span className="text-2xl font-black block text-sky-600">{stats.newCount}</span>
          <span className="text-[10px] opacity-75">بانتظار المراجعة والاعتماد</span>
        </button>

        {/* قيد المراجعة */}
        <button
          type="button"
          onClick={() => setStatusFilter('under_review')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'under_review'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white hover:bg-blue-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 opacity-80">
            <span className="font-bold">قيد المراجعة</span>
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-2xl font-black block text-blue-600">{stats.underReviewCount}</span>
          <span className="text-[10px] opacity-75">قيد التدقيق من المشرف</span>
        </button>

        {/* المعتمدة */}
        <button
          type="button"
          onClick={() => setStatusFilter('approved')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'approved'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
              : 'bg-white hover:bg-emerald-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 opacity-80">
            <span className="font-bold">معتمدة ومكتملة</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-black block text-emerald-600">{stats.approvedCount}</span>
          <span className="text-[10px] opacity-75">تم اعتمادها وإضافتها للسجل</span>
        </button>

        {/* تحتاج استكمال */}
        <button
          type="button"
          onClick={() => setStatusFilter('needs_revision')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            statusFilter === 'needs_revision'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-white hover:bg-amber-50/50 border-slate-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1.5 opacity-80">
            <span className="font-bold">تحتاج استكمال</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-black block text-amber-600">{stats.needsRevisionCount}</span>
          <span className="text-[10px] opacity-75">أُعيدت للطالب للتوضيح</span>
        </button>
      </div>

      {/* 2. شريط البحث والتصفية */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* البحث بالاسم أو الكتاب */}
          <div className="relative md:col-span-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الطالب، عنوان الكتاب، أو الملاحظات..."
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-4 py-2.5 pr-10 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#3b707d]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>

          {/* تصفية حسب المجموعة */}
          <div>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#3b707d]"
            >
              <option value="all">جميع المجموعات</option>
              {allGroups.map((grp) => (
                <option key={grp} value={grp}>
                  مجموعة: {grp}
                </option>
              ))}
            </select>
          </div>

          {/* تصفية حسب الفترة */}
          <div>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-[#3b707d]"
            >
              <option value="all">جميع الفترات الزمنية</option>
              <option value="today">خلال آخر 24 ساعة</option>
              <option value="week">خلال آخر 7 أيام</option>
              <option value="month">خلال هذا الشهر</option>
            </select>
          </div>
        </div>

        {/* Row 2: Status tabs & Supervisors filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 ml-1">تصفية الحالة:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'new', label: 'جديد' },
              { id: 'under_review', label: 'قيد المراجعة' },
              { id: 'approved', label: 'معتمد' },
              { id: 'needs_revision', label: 'يحتاج استكمال' },
              { id: 'rejected', label: 'مرفوض' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id as any)}
                className={`px-3 py-1 rounded-xl font-bold transition-all ${
                  statusFilter === st.id
                    ? 'bg-[#3b707d] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-bold text-slate-500">
            عدد النتائج المعروضة: <span className="text-[#3b707d] font-black">{filteredCompletions.length}</span> طلب
          </div>
        </div>
      </div>

      {/* 3. جدول طلبات إكمال الكتب */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredCompletions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-black text-base text-slate-800">لا توجد طلبات مطابقة للمعايير المحددة</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              عندما يقوم الطلاب بإنهاء قراءة كتبهم والضغط على زر «إكمال الكتاب»، ستظهر طلباتهم هنا للمراجعة والاعتماد.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#f8fafc] text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">الطالب</th>
                  <th className="p-4">الكتاب</th>
                  <th className="p-4">المجموعة</th>
                  <th className="p-4">تاريخ الاستعارة</th>
                  <th className="p-4">تاريخ التقديم</th>
                  <th className="p-4">حالة الطلب</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompletions.map((comp) => {
                  const student = students.find((s) => s.id === comp.studentId);
                  const book = books.find((b) => b.id === comp.bookId);
                  const loan = loans.find((l) => l.id === comp.loanId);

                  return (
                    <tr key={comp.id} className="hover:bg-[#f8fafc]/70 transition-colors">
                      {/* الطالب */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3b707d] to-[#2c5661] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                            {student?.fullName ? student.fullName.slice(0, 1) : 'ط'}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 leading-snug">
                              {student?.fullName || 'طالب غير محدد'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              #{student?.internalId || comp.studentId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* الكتاب */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          {book?.coverImageUrl ? (
                            <img
                              src={book.coverImageUrl}
                              alt={book.title}
                              className="w-8 h-11 object-cover rounded-md shadow-2xs shrink-0 border border-slate-200"
                            />
                          ) : (
                            <div className="w-8 h-11 rounded-md bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center shrink-0">
                              <BookOpen className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 line-clamp-1 max-w-[200px]">
                              {book?.title || 'كتاب مستعار'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {book?.author || 'المؤلف'} {book?.pageCount ? `• ${book.pageCount} صفحة` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* المجموعة */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {student?.groupName || 'المجموعة العامة'}
                        </span>
                      </td>

                      {/* تاريخ الاستعارة */}
                      <td className="p-4 font-mono text-slate-600 text-[11px]">
                        {loan ? new Date(loan.loanDate).toLocaleDateString('ar-SA') : '-'}
                      </td>

                      {/* تاريخ تقديم طلب الإكمال */}
                      <td className="p-4 font-mono text-slate-600 text-[11px]">
                        {new Date(comp.requestDate || comp.createdAt).toLocaleDateString('ar-SA')}
                        <span className="block text-[9px] text-slate-400 font-sans">
                          {new Date(comp.requestDate || comp.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* حالة الطلب */}
                      <td className="p-4">
                        {getStatusBadge(comp.status)}
                      </td>

                      {/* الإجراءات */}
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCompletion(comp)}
                            className="px-3 py-1.5 rounded-xl bg-[#e3ecf3]/70 hover:bg-[#3b707d] text-[#2c5661] hover:text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-2xs"
                            title="عرض تفاصيل الطلب"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض التفاصيل</span>
                          </button>

                          {comp.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleConfirmDirectApprove(comp)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white font-bold text-xs border border-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="اعتماد فوري ومباشر بنقرة واحدة"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">اعتماد</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. نافذة تفاصيل طلب الإكمال (Details Modal) */}
      {selectedCompletion && (
        <Modal
          isOpen={Boolean(selectedCompletion)}
          onClose={() => setSelectedCompletion(null)}
          title="تفاصيل طلب إكمال قراءة الكتاب"
          subtitle={`طلب مقدم من الطالب #${selectedCompletion.studentId}`}
          maxWidth="2xl"
        >
          {(() => {
            const student = students.find((s) => s.id === selectedCompletion.studentId);
            const book = books.find((b) => b.id === selectedCompletion.bookId);
            const loan = loans.find((l) => l.id === selectedCompletion.loanId);
            const copy = copies.find((c) => c.id === loan?.copyId);

            return (
              <div className="space-y-5 text-right">
                {/* Status Bar */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">الحالة الراهنة للطلب:</span>
                    {getStatusBadge(selectedCompletion.status)}
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono">
                    تاريخ الطلب: {formatArabicDateTime(selectedCompletion.requestDate || selectedCompletion.createdAt)}
                  </div>
                </div>

                {/* Grid: Student Info & Book Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* بيانات الطالب */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <Users className="w-4 h-4 text-[#3b707d]" />
                      <h4 className="font-black text-xs text-slate-800">بيانات الطالب</h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">الاسم الكامل:</span>
                        <span className="font-black text-slate-800">{student?.fullName || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">المعرف الداخلي:</span>
                        <span className="font-mono font-bold text-[#3b707d]">#{student?.internalId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">المجموعة:</span>
                        <span className="font-bold text-slate-700">{student?.groupName || 'المجموعة العامة'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">الصف الدراسي:</span>
                        <span className="font-bold text-slate-700">{student?.grade || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400">إجمالي الكتب المعتمدة:</span>
                        <span className="font-black text-emerald-700">{student?.totalBooksRead || 0} كتاب</span>
                      </div>
                    </div>
                  </div>

                  {/* بيانات الكتاب */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <BookOpen className="w-4 h-4 text-[#3b707d]" />
                      <h4 className="font-black text-xs text-slate-800">بيانات الكتاب المستعار</h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">عنوان الكتاب:</span>
                        <span className="font-black text-slate-800 truncate max-w-[180px]">{book?.title || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">المؤلف:</span>
                        <span className="font-bold text-slate-700">{book?.author || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">عدد الصفحات:</span>
                        <span className="font-bold text-slate-700">{book?.pageCount ? `${book.pageCount} صفحة` : '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">رقم النسخة المستعارة:</span>
                        <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {copy?.copyCode || 'نسخة أصلية'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400">الفئة العمرية:</span>
                        <span className="font-bold text-slate-700">{book?.ageGroup || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* تفاصيل عملية الإعارة المرتبطة */}
                <div className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 space-y-2 text-xs">
                  <h4 className="font-black text-xs text-slate-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#3b707d]" />
                    <span>تفاصيل عملية الإعارة المرتبطة بالطلب</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">تاريخ الاستعارة</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {loan ? new Date(loan.loanDate).toLocaleDateString('ar-SA') : '-'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">تاريخ الاستحقاق</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {loan ? new Date(loan.dueDate).toLocaleDateString('ar-SA') : '-'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">تاريخ الإرجاع الفعلي</span>
                      <span className="font-bold text-slate-800 font-mono">
                        {loan?.returnDate ? new Date(loan.returnDate).toLocaleDateString('ar-SA') : 'لم يُعد بعد (نشط)'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">حالة الإعارة الفعلية</span>
                      <span className="font-bold text-slate-800">
                        {loan?.status === 'returned' ? 'مستعاد للمكتبة' : 'قيد الإعارة حالياً'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ملاحظات الطالب عند الإكمال */}
                {selectedCompletion.studentNotes && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5 text-xs">
                    <span className="font-black text-amber-900 block flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-amber-600" />
                      <span>ملاحظات الطالب وتلخيصه للإكمال:</span>
                    </span>
                    <p className="text-slate-700 leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-200/80">
                      {selectedCompletion.studentNotes}
                    </p>
                  </div>
                )}

                {/* ملاحظات المشرف أو سبب الرفض/الإعادة إن وجد */}
                {selectedCompletion.revisionReason && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                    <span className="font-bold block">ملاحظات طلب الاستكمال:</span>
                    <p>{selectedCompletion.revisionReason}</p>
                  </div>
                )}

                {selectedCompletion.rejectionReason && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1">
                    <span className="font-bold block">سبب رفض الطلب:</span>
                    <p>{selectedCompletion.rejectionReason}</p>
                  </div>
                )}

                {/* سجل الطلب وتحديثاته السابقة (Timeline History) */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                      <HistoryIcon className="w-4 h-4 text-[#3b707d]" />
                      <span>سجل الإجراءات والقرارات على الطلب</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {(selectedCompletion.history || []).length} عمليات موثقة
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {(selectedCompletion.history || []).length === 0 ? (
                      <div className="text-center py-3 text-xs text-slate-400">
                        تم إنشاء الطلب بتاريخ {new Date(selectedCompletion.requestDate || selectedCompletion.createdAt).toLocaleDateString('ar-SA')}
                      </div>
                    ) : (
                      selectedCompletion.history?.map((h) => (
                        <div
                          key={h.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-start justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{h.actionLabel}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                                {h.actorName}
                              </span>
                            </div>
                            {h.note && <p className="text-[11px] text-slate-600">{h.note}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0" dir="ltr">
                            {formatShortTime(h.createdAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* خانة الملاحظات الإدارية */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ملاحظات الإدارة الداخلية (تبقى محفوظة في سجل الطلب):
                  </label>
                  <textarea
                    rows={2}
                    value={adminNotesInput}
                    onChange={(e) => setAdminNotesInput(e.target.value)}
                    placeholder="اكتب ملاحظات توجيهية للمشرفين أو توثيقاً داخلياً..."
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#3b707d]"
                  />
                  {adminNotesInput !== (selectedCompletion.adminNotes || '') && (
                    <button
                      type="button"
                      onClick={() => {
                        updateReadingCompletionAdminNotes({
                          completionId: selectedCompletion.id,
                          adminNotes: adminNotesInput,
                        });
                        showToast('تم حفظ الملاحظات الإدارية بنجاح.', 'success');
                      }}
                      className="text-[11px] text-[#3b707d] font-bold hover:underline"
                    >
                      حفظ الملاحظة فقط دون تغيير الحالة
                    </button>
                  )}
                </div>

                {/* مربع كتابة السبب في حال الإعادة أو الرفض (Inline Action Panel داخل نفس النافذة) */}
                {actionType && (actionType === 'return' || actionType === 'reject') && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>
                        {actionType === 'return'
                          ? 'سبب إعادة الطلب والمطلوب استكماله من الطالب: *'
                          : 'سبب رفض الطلب: *'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActionType(null)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                      >
                        إلغاء الملاحظة
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder={
                        actionType === 'return'
                          ? 'مثال: يرجى كتابة ملخص موجز لأهم 3 فوائد خرجت بها من قراءة الكتاب...'
                          : 'مثال: لم يتم استيفاء شروط القراءة...'
                      }
                      className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#3b707d]"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActionType(null)}
                        disabled={isSubmittingAction}
                      >
                        إلغاء
                      </Button>
                      <Button
                        type="button"
                        variant={actionType === 'return' ? 'secondary' : 'danger'}
                        size="sm"
                        onClick={handleConfirmAction}
                        disabled={isSubmittingAction || !actionReason.trim()}
                      >
                        {isSubmittingAction
                          ? 'جارٍ الحفظ...'
                          : actionType === 'return'
                          ? 'إرسال الملاحظات للطالب'
                          : 'تأكيد الرفض'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* أزرار الإجراءات في أسفل النافذة */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedCompletion.status !== 'approved' && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={<Check className="w-4 h-4" />}
                        onClick={() => handleConfirmDirectApprove(selectedCompletion)}
                        disabled={isSubmittingAction}
                      >
                        {isSubmittingAction ? 'جارٍ الاعتماد...' : 'اعتماد إكمال الكتاب'}
                      </Button>
                    )}

                    {selectedCompletion.status !== 'under_review' && selectedCompletion.status !== 'approved' && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<Clock className="w-4 h-4" />}
                        onClick={() => handleConfirmDirectReview(selectedCompletion)}
                        disabled={isSubmittingAction}
                      >
                        وضع قيد المراجعة
                      </Button>
                    )}

                    {selectedCompletion.status !== 'needs_revision' && selectedCompletion.status !== 'approved' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={<RotateCcw className="w-4 h-4 text-amber-600" />}
                        onClick={() => {
                          setActionType(actionType === 'return' ? null : 'return');
                          setActionReason('');
                        }}
                      >
                        إعادة للاستكمال
                      </Button>
                    )}

                    {selectedCompletion.status !== 'rejected' && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        icon={<XCircle className="w-4 h-4" />}
                        onClick={() => {
                          setActionType(actionType === 'reject' ? null : 'reject');
                          setActionReason('');
                        }}
                      >
                        رفض الطلب
                      </Button>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedCompletion(null);
                      setActionType(null);
                    }}
                  >
                    إغلاق
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};

// Helper for formatting short times
function formatShortTime(isoDate?: string): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    return `${d.toLocaleDateString('ar-SA')} ${d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return isoDate;
  }
}

// Icon alias
const HistoryIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);
