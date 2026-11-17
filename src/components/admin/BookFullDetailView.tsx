import React, { useState } from 'react';
import { Book, BookCopy } from '../../types';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { BookLabelPrintSheet } from '../qr/BookLabelPrintSheet';
import { EditBookModal } from './EditBookModal';
import { CopyDetailModal } from './CopyDetailModal';
import { HorizontalBarChart, VerticalColumnChart } from '../reports/ReportCharts';
import {
  formatArabicDate,
  formatArabicDateTime,
  formatUmmAlQuraDate,
  getLoanCountdown,
  isOverdue,
} from '../../lib/dateUtils';
import {
  downloadOfficialReportPdf,
  exportStructuredExcelReport,
  printOfficialReport,
  OfficialReportPayload,
} from '../../lib/reportExportUtils';
import { isDiscussionCompletedOrApproved } from '../../lib/discussionUtils';
import {
  ArrowRight,
  BookOpen,
  Layers,
  Plus,
  Printer,
  Edit,
  FileText,
  Download,
  AlertTriangle,
  Search,
  User,
  Clock,
  CheckCircle2,
  QrCode,
  TrendingUp,
  History,
  Activity,
  MessageSquareText,
  Eye,
  Sparkles,
} from 'lucide-react';

interface BookFullDetailViewProps {
  book: Book;
  onBack: () => void;
  onNavigateToStudentReport?: (studentId: string) => void;
}

export const BookFullDetailView: React.FC<BookFullDetailViewProps> = ({
  book,
  onBack,
  onNavigateToStudentReport,
}) => {
  const {
    books,
    copies,
    categories,
    loans,
    loanEvents,
    reservations,
    conditionReports,
    readingLogs,
    discussions,
    students,
    staff,
    auditLogs,
    reportSettings,
    addCopy,
    updateBook,
    readingCompletions,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveBook = books.find((b) => b.id === book.id) || book;
  const category = categories.find((c) => c.id === liveBook.categoryId);

  const [activeTab, setActiveTab] = useState<'loans_history' | 'copies' | 'timeline' | 'analytics'>('loans_history');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [completionFilter, setCompletionFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedCopyDetail, setSelectedCopyDetail] = useState<BookCopy | null>(null);
  const [editBookOpen, setEditBookOpen] = useState(false);
  const [printBarcodesOpen, setPrintBarcodesOpen] = useState(false);
  const [newCopyShelf, setNewCopyShelf] = useState('الرف العام');
  const [addCopyPromptOpen, setAddCopyPromptOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ========================================================================
  // حسابات إحصائية دقيقة ومتطابقة 100% مع السجلات الفعلية (Section 3.1)
  // ========================================================================
  const bookCopies = copies.filter((c) => c.bookId === liveBook.id);
  const bookCopyIds = new Set(bookCopies.map((c) => c.id));

  const availableCopies = bookCopies.filter((c) => c.status === 'available');
  const currentlyBorrowedCopies = bookCopies.filter(
    (c) => c.status === 'borrowed' || c.status === 'overdue'
  );
  const reservedCopies = bookCopies.filter(
    (c) => c.status === 'reserved' || c.status === 'in_preparation'
  );
  const underInspectionCopies = bookCopies.filter((c) => c.status === 'under_inspection');
  const damagedCopies = bookCopies.filter(
    (c) => c.status === 'damaged' || c.status === 'maintenance'
  );
  const lostCopies = bookCopies.filter((c) => c.status === 'lost');

  // Historical loans (NOT merged with currently borrowed!)
  const bookLoansAll = loans
    .filter((l) => bookCopyIds.has(l.copyId) && l.status !== 'cancelled')
    .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime());

  const activeBookLoans = bookLoansAll.filter(
    (l) => l.status === 'active' || l.status === 'overdue'
  );
  const returnedBookLoans = bookLoansAll.filter((l) => l.status === 'returned');

  const uniqueBorrowersIds = new Set(bookLoansAll.map((l) => l.studentId));
  const uniqueCopiesBorrowedIds = new Set(bookLoansAll.map((l) => l.copyId));

  // ========================================================================
  // إحصائيات استعارة الكتاب الأساسية السبعة الدقيقة (وفق متطلبات نظام مداد)
  // ========================================================================
  // 1. إجمالي مرات الاستعارة منذ إضافة الكتاب إلى المكتبة
  const totalLoansCount = bookLoansAll.length;

  // 2. عدد مرات الاستعارة الحالية
  const currentActiveLoansCount = activeBookLoans.length;

  // 3. عدد مرات الإعارة المكتملة تاريخياً
  const historicalReturnedLoansCount = returnedBookLoans.length;

  // 4. عدد الطلاب المختلفين الذين استعاروا الكتاب
  const uniqueBorrowersCount = uniqueBorrowersIds.size;

  // 5. عدد مرات إكمال قراءة الكتاب بعد الاستعارة واعتمادها
  const bookApprovedCompletionsCount = (readingCompletions || []).filter(
    (c) => c.bookId === liveBook.id && c.status === 'approved'
  ).length;

  // 6. عدد مرات إعادة استعارة الكتاب من الطالب نفسه
  const studentBorrowCounts = new Map<string, number>();
  bookLoansAll.forEach((l) => {
    studentBorrowCounts.set(l.studentId, (studentBorrowCounts.get(l.studentId) || 0) + 1);
  });
  let repeatBorrowCount = 0;
  studentBorrowCounts.forEach((count) => {
    if (count > 1) repeatBorrowCount += count - 1;
  });

  // 7. عدد مرات التأخر في الإرجاع
  const overdueLoansCount = bookLoansAll.filter((l) => {
    if (l.status === 'overdue') return true;
    if (l.status === 'active' && isOverdue(l.dueDate)) return true;
    if (l.returnDate && new Date(l.returnDate).getTime() > new Date(l.dueDate).getTime()) return true;
    return false;
  }).length;

  // ========================================================================
  // إعداد بيانات جدول حركة واستعارات الكتاب بالكامل (Movement History Table)
  // ========================================================================
  const loanHistoryRows = bookLoansAll.map((loan) => {
    const student = students.find((s) => s.id === loan.studentId);
    const supervisor = staff.find((st) => st.id === loan.supervisorId);
    const copy = bookCopies.find((c) => c.id === loan.copyId);
    const completion = (readingCompletions || []).find((c) => c.loanId === loan.id);
    return {
      loan,
      student,
      supervisor,
      copy,
      completion,
    };
  });

  const uniqueLoanGroups = Array.from(
    new Set(loanHistoryRows.map((r) => r.student?.groupName).filter(Boolean))
  );

  const filteredLoanHistoryRows = loanHistoryRows.filter((row) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      (row.student?.fullName.toLowerCase().includes(term) ?? false) ||
      (row.student?.internalId.toLowerCase().includes(term) ?? false) ||
      (row.copy?.copyCode.toLowerCase().includes(term) ?? false) ||
      (row.supervisor?.fullName.toLowerCase().includes(term) ?? false);

    const matchGroup = groupFilter === 'all' || row.student?.groupName === groupFilter;
    const matchStudent = studentFilter === 'all' || row.student?.id === studentFilter;

    let matchStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') matchStatus = row.loan.status === 'active';
      else if (statusFilter === 'returned') matchStatus = row.loan.status === 'returned';
      else if (statusFilter === 'overdue')
        matchStatus = row.loan.status === 'overdue' || (row.loan.status === 'active' && isOverdue(row.loan.dueDate));
    }

    let matchCompletion = true;
    if (completionFilter !== 'all') {
      if (completionFilter === 'completed') matchCompletion = row.completion?.status === 'approved';
      else if (completionFilter === 'pending') matchCompletion = row.completion?.status === 'pending_approval';
      else if (completionFilter === 'none') matchCompletion = !row.completion || row.completion.status === 'rejected';
    }

    let matchDate = true;
    if (dateFrom) {
      matchDate = new Date(row.loan.loanDate) >= new Date(`${dateFrom}T00:00:00`);
    }
    if (matchDate && dateTo) {
      matchDate = new Date(row.loan.loanDate) <= new Date(`${dateTo}T23:59:59`);
    }

    return matchSearch && matchGroup && matchStudent && matchStatus && matchCompletion && matchDate;
  });

  // Reading completions (students whose approved reading logs for this book >= book.pageCount)
  const targetPages = liveBook.pageCount && liveBook.pageCount > 0 ? liveBook.pageCount : 100;
  const approvedPagesPerStudent = new Map<string, number>();
  readingLogs
    .filter((l) => l.bookId === liveBook.id && l.status === 'approved')
    .forEach((l) => {
      approvedPagesPerStudent.set(
        l.studentId,
        (approvedPagesPerStudent.get(l.studentId) || 0) + (l.correctedPagesCount ?? l.pagesCount)
      );
    });
  let completedReadingCount = 0;
  approvedPagesPerStudent.forEach((pSum) => {
    if (pSum >= targetPages) completedReadingCount += 1;
  });

  const bookDiscussions = discussions.filter((d) => d.bookId === liveBook.id);
  const completedBookDiscussions = bookDiscussions.filter((d) => isDiscussionCompletedOrApproved(d));

  const bookReservations = reservations.filter((r) => r.bookId === liveBook.id);
  const activeReservations = bookReservations.filter((r) =>
    ['new_request', 'pending_approval', 'approved', 'preparing', 'ready_for_pickup'].includes(
      r.status
    )
  );
  const bookReports = conditionReports.filter((r) => bookCopyIds.has(r.copyId));

  // Percentages for visual bar
  const totalCopiesCount = bookCopies.length;
  const availPct = totalCopiesCount > 0 ? Math.round((availableCopies.length / totalCopiesCount) * 100) : 0;
  const borrowedPct = totalCopiesCount > 0 ? Math.round((currentlyBorrowedCopies.length / totalCopiesCount) * 100) : 0;
  const otherPct = Math.max(0, 100 - availPct - borrowedPct);

  // ========================================================================
  // تنبيهات إدارة النسخ الذكية (Section 3.6)
  // ========================================================================
  const smartAlerts: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];

  if (totalCopiesCount > 0 && availableCopies.length === 0) {
    if (currentlyBorrowedCopies.length === totalCopiesCount) {
      smartAlerts.push({
        type: 'warning',
        message: 'جميع النسخ مستعارة حالياً لدى الطلاب ولا توجد أي نسخة متاحة على الرف.',
      });
    } else {
      smartAlerts.push({
        type: 'danger',
        message: 'لا توجد نسخ متاحة للإعارة حالياً (مستعارة أو قيد الفحص/الصيانة).',
      });
    }
  }

  const overdueActiveLoans = activeBookLoans.filter((l) => isOverdue(l.dueDate));
  if (overdueActiveLoans.length > 0) {
    smartAlerts.push({
      type: 'danger',
      message: `يوجد ${overdueActiveLoans.length} نسخة متأخرة عن موعد الإرجاع!`,
    });
  }

  const longInspectionCopies = underInspectionCopies.filter((c) => {
    const latestRet = bookReports
      .filter((r) => r.copyId === c.id && r.stage === 'return')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    if (!latestRet) return true;
    return Date.now() - new Date(latestRet.createdAt).getTime() > 24 * 60 * 60 * 1000;
  });
  if (longInspectionCopies.length > 0) {
    smartAlerts.push({
      type: 'warning',
      message: `توجد ${longInspectionCopies.length} نسخة قيد الفحص على رف الإرجاع منذ أكثر من 24 ساعة.`,
    });
  }

  if (damagedCopies.length > 0) {
    smartAlerts.push({
      type: 'danger',
      message: `توجد ${damagedCopies.length} نسخة متضررة أو تحت الصيانة تتطلب معالجة.`,
    });
  }

  if (lostCopies.length > 0) {
    smartAlerts.push({
      type: 'danger',
      message: `توجد ${lostCopies.length} نسخة مفقودة مسجلة في المخزون.`,
    });
  }

  const utilizationRatio =
    totalCopiesCount > 0 ? Math.round((uniqueCopiesBorrowedIds.size / totalCopiesCount) * 100) : 0;
  const isHighDemand =
    totalCopiesCount > 0 &&
    (activeReservations.length > availableCopies.length ||
      bookLoansAll.length >= totalCopiesCount * 2 ||
      (availableCopies.length === 0 && activeReservations.length > 0));
  if (isHighDemand) {
    smartAlerts.push({
      type: 'info',
      message: 'ارتفاع الطلب على الكتاب — يوصى بشراء وإضافة نسخ إضافية لتغطية احتياج الطلاب.',
    });
  }

  // ========================================================================
  // جدول جميع النسخ والبحث والتصفية (Section 3.2)
  // ========================================================================
  const copyRows = bookCopies.map((copy) => {
    const copyLoansForRow = bookLoansAll.filter((l) => l.copyId === copy.id);
    const activeLoan = copyLoansForRow.find((l) => l.status === 'active' || l.status === 'overdue');
    const latestReturnedLoan = copyLoansForRow.find((l) => l.status === 'returned');
    const displayLoan = activeLoan || latestReturnedLoan;
    const borrower = activeLoan ? students.find((s) => s.id === activeLoan.studentId) : undefined;
    const supervisor = displayLoan ? staff.find((st) => st.id === displayLoan.supervisorId) : undefined;

    return {
      copy,
      activeLoan,
      latestReturnedLoan,
      displayLoan,
      borrower,
      supervisor,
    };
  });

  const uniqueGroupsForFilter = Array.from(
    new Set(
      copyRows
        .map((r) => r.borrower?.groupName)
        .filter((g): g is string => Boolean(g))
    )
  );
  const uniqueBorrowersForFilter = Array.from(uniqueBorrowersIds)
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const filteredCopyRows = copyRows.filter((row) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      row.copy.copyCode.toLowerCase().includes(term) ||
      row.copy.shelfLocation.toLowerCase().includes(term) ||
      (row.borrower?.fullName.toLowerCase().includes(term) ?? false);

    const matchStatus = statusFilter === 'all' || row.copy.status === statusFilter;
    const matchGroup = groupFilter === 'all' || row.borrower?.groupName === groupFilter;
    const matchStudent =
      studentFilter === 'all' ||
      row.borrower?.id === studentFilter ||
      bookLoansAll.some((l) => l.copyId === row.copy.id && l.studentId === studentFilter);

    let matchDate = true;
    if (dateFrom && row.displayLoan) {
      matchDate = new Date(row.displayLoan.loanDate) >= new Date(`${dateFrom}T00:00:00`);
    } else if (dateFrom && !row.displayLoan) {
      matchDate = false;
    }
    if (matchDate && dateTo && row.displayLoan) {
      matchDate = new Date(row.displayLoan.loanDate) <= new Date(`${dateTo}T23:59:59`);
    } else if (dateTo && !row.displayLoan) {
      matchDate = false;
    }

    return matchSearch && matchStatus && matchGroup && matchStudent && matchDate;
  });

  // ========================================================================
  // سجل حركة الكتاب بالكامل Timeline + لوحة آخر النشاطات (Section 3.4 & 4.2)
  // ========================================================================
  interface BookTimelineEvent {
    id: string;
    date: string;
    category: 'book' | 'copy' | 'checkout' | 'return' | 'reservation' | 'inspection' | 'discussion' | 'status';
    title: string;
    actor: string;
    description: string;
  }

  const timelineEvents: BookTimelineEvent[] = [];

  timelineEvents.push({
    id: `tl-book-${liveBook.id}`,
    date: liveBook.createdAt,
    category: 'book',
    title: 'إضافة الكتاب إلى الفهرس',
    actor: 'إدارة المكتبة',
    description: `إدراج كتاب "${liveBook.title}" برمز ${liveBook.code}`,
  });

  bookCopies.forEach((cp) => {
    timelineEvents.push({
      id: `tl-copy-${cp.id}`,
      date: cp.createdAt,
      category: 'copy',
      title: `إضافة نسخة ورقية (${cp.copyCode})`,
      actor: 'إدارة المكتبة',
      description: `موقع الرف: ${cp.shelfLocation} • الحالة المبدئية: ${cp.condition}`,
    });
  });

  bookLoansAll.forEach((l) => {
    const stu = students.find((s) => s.id === l.studentId);
    const sup = staff.find((st) => st.id === l.supervisorId);
    const cp = bookCopies.find((c) => c.id === l.copyId);
    timelineEvents.push({
      id: `tl-loan-${l.id}`,
      date: l.loanDate,
      category: 'checkout',
      title: `استعارة نسخة ${cp?.copyCode || ''}`,
      actor: sup?.fullName || 'مشرف المكتبة',
      description: `استعار الطالب ${stu?.fullName || ''} النسخة • موعد الإرجاع: ${formatUmmAlQuraDate(l.dueDate)}`,
    });
    if (l.returnDate) {
      const retSup = staff.find((st) => st.id === l.returnedToSupervisorId);
      timelineEvents.push({
        id: `tl-ret-${l.id}`,
        date: l.returnDate,
        category: 'return',
        title: `إرجاع نسخة ${cp?.copyCode || ''}`,
        actor: retSup?.fullName || sup?.fullName || 'مشرف المكتبة',
        description: `أعاد الطالب ${stu?.fullName || ''} النسخة للمكتبة`,
      });
    }
  });

  bookReservations.forEach((r) => {
    const stu = students.find((s) => s.id === r.studentId);
    timelineEvents.push({
      id: `tl-res-${r.id}`,
      date: r.requestedAt,
      category: 'reservation',
      title: 'حجز الكتاب',
      actor: stu?.fullName || 'طالب',
      description: `طلب حجز من الطالب ${stu?.fullName || ''} (${r.status})`,
    });
  });

  bookReports.forEach((rep) => {
    const cp = bookCopies.find((c) => c.id === rep.copyId);
    const repStaff = staff.find((st) => st.id === rep.staffId);
    timelineEvents.push({
      id: `tl-rep-${rep.id}`,
      date: rep.createdAt,
      category: rep.rating === 'damaged' || rep.rating === 'lost' ? 'status' : 'inspection',
      title: `فحص نسخة ${cp?.copyCode || ''} (${rep.rating})`,
      actor: repStaff?.fullName || 'مشرف الفحص',
      description: rep.details || 'توثيق حالة النسخة',
    });
  });

  bookDiscussions.forEach((d) => {
    const stu = students.find((s) => s.id === d.studentId);
    const sup = staff.find((st) => st.id === d.supervisorId);
    timelineEvents.push({
      id: `tl-disc-${d.id}`,
      date: d.approvedAt || d.discussionDate || d.requestDate,
      category: 'discussion',
      title: `مناقشة قرائية (${d.status === 'approved' ? 'معتمدة' : 'مسجلة'})`,
      actor: sup?.fullName || stu?.fullName || '',
      description: `الطالب: ${stu?.fullName || ''} • الدرجة: ${d.totalScore}/${d.maxScore || 100}`,
    });
  });

  auditLogs.forEach((a) => {
    if (
      (a.entityType === 'book_copy' && bookCopyIds.has(a.entityId || '')) ||
      (a.entityType === 'book' && a.entityId === liveBook.id)
    ) {
      if (a.action.includes('تعديل') || a.action.includes('تلف') || a.action.includes('فقد')) {
        timelineEvents.push({
          id: `tl-audit-${a.id}`,
          date: a.createdAt,
          category: 'status',
          title: a.action,
          actor: a.actorName,
          description: a.notes || a.reason || '',
        });
      }
    }
  });

  const sortedTimeline = timelineEvents.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // ========================================================================
  // تحليلات الطلب على الكتاب (Section 3.5)
  // ========================================================================
  const returnedDurations = returnedBookLoans
    .filter((l) => l.returnDate)
    .map((l) =>
      Math.max(
        1,
        Math.round((new Date(l.returnDate!).getTime() - new Date(l.loanDate).getTime()) / 86400000)
      )
    );
  const avgLoanDays =
    returnedDurations.length > 0
      ? Math.round(returnedDurations.reduce((s, d) => s + d, 0) / returnedDurations.length)
      : 0;

  const loansByMonthMap = new Map<string, number>();
  const loansByGroupMap = new Map<string, number>();
  const loansByStudentMap = new Map<string, number>();
  bookLoansAll.forEach((l) => {
    const dt = new Date(l.loanDate);
    if (!isNaN(dt.getTime())) {
      const mLabel = new Intl.DateTimeFormat('ar-SA', { month: 'short', year: 'numeric' }).format(dt);
      loansByMonthMap.set(mLabel, (loansByMonthMap.get(mLabel) || 0) + 1);
    }
    const stu = students.find((s) => s.id === l.studentId);
    if (stu) {
      loansByGroupMap.set(stu.groupName, (loansByGroupMap.get(stu.groupName) || 0) + 1);
      loansByStudentMap.set(stu.fullName, (loansByStudentMap.get(stu.fullName) || 0) + 1);
    }
  });

  const periodDemandChart = Array.from(loansByMonthMap.entries()).map(([label, value]) => ({
    label,
    value,
  }));
  const groupDemandChart = Array.from(loansByGroupMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
  const topBookReaders = Array.from(loansByStudentMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  const handleAddNewCopy = () => {
    const created = addCopy(liveBook.id, newCopyShelf.trim() || 'الرف العام');
    showToast(`تمت إضافة النسخة ${created.copyCode} لكتاب "${liveBook.title}" بنجاح`, 'success');
    setAddCopyPromptOpen(false);
  };

  const buildBookReportPayload = (): OfficialReportPayload => ({
    reportTitle: `تقرير تفصيلي للكتاب: ${liveBook.title}`,
    subtitle: `${liveBook.code} • التأليف: ${liveBook.author || '-'} • التصنيف: ${category?.name || '-'}`,
    periodLabel: 'جميع الفترات حتى الآن',
    metadata: [
      { label: 'رمز الكتاب', value: liveBook.code },
      { label: 'المؤلف', value: liveBook.author || '-' },
      { label: 'التصنيف', value: category?.name || '-' },
      { label: 'عدد الصفحات', value: `${liveBook.pageCount || '-'} صفحة` },
      { label: 'نسبة استخدام النسخ', value: `${utilizationRatio}%` },
      { label: 'متوسط مدة الإعارة', value: `${avgLoanDays} يوم` },
    ],
    kpis: [
      { label: 'إجمالي النسخ الأصلية', value: totalCopiesCount },
      { label: 'النسخ المتاحة حالياً', value: availableCopies.length },
      { label: 'النسخ المستعارة حالياً', value: currentlyBorrowedCopies.length },
      { label: 'النسخ قيد الفحص', value: underInspectionCopies.length },
      { label: 'المتضررة / المفقودة', value: damagedCopies.length + lostCopies.length },
      { label: 'إجمالي الاستعارات التاريخية', value: bookLoansAll.length },
      { label: 'عدد الطلاب المستعيرين', value: uniqueBorrowersIds.size },
      { label: 'عدد المناقشات', value: completedBookDiscussions.length },
    ],
    tables: [
      {
        title: 'جدول جميع نسخ الكتاب',
        columns: ['رقم النسخة', 'الحالة', 'الموقع', 'الطالب الحالي', 'المجموعة', 'تاريخ الاستعارة', 'موعد الإرجاع'],
        rows: copyRows.map((r) => [
          r.copy.copyCode,
          r.copy.status,
          r.copy.shelfLocation,
          r.borrower?.fullName || '—',
          r.borrower?.groupName || '—',
          r.activeLoan ? formatArabicDate(r.activeLoan.loanDate) : '—',
          r.activeLoan ? formatArabicDate(r.activeLoan.dueDate) : '—',
        ]),
      },
    ],
  });

  const handleExportBookPdf = async () => {
    setExportingPdf(true);
    try {
      await downloadOfficialReportPdf(
        buildBookReportPayload(),
        reportSettings,
        `تقرير_كتاب_${liveBook.code}`
      );
      showToast('تم إصدار تقرير الكتاب بصيغة PDF بنجاح 📄', 'success');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-black text-wathba-800 hover:bg-wathba-50 transition-colors shadow-xs"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى فهرس الكتب</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={exportingPdf}
            icon={<FileText className="w-3.5 h-3.5" />}
            onClick={handleExportBookPdf}
          >
            إصدار تقرير الكتاب (PDF)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={() => {
              exportStructuredExcelReport(`تقرير_كتاب_${liveBook.code}`, [
                {
                  sheetName: 'ملخص الكتاب',
                  rows: [
                    { البيان: 'العنوان', القيمة: liveBook.title },
                    { البيان: 'المؤلف', القيمة: liveBook.author },
                    { البيان: 'الصفحات', القيمة: liveBook.pageCount || '-' },
                    { البيان: 'إجمالي النسخ', القيمة: totalCopiesCount },
                    { البيان: 'النسخ المتاحة', القيمة: availableCopies.length },
                    { البيان: 'المستعارة حالياً', القيمة: currentlyBorrowedCopies.length },
                    { البيان: 'الاستعارات التاريخية', القيمة: bookLoansAll.length },
                  ],
                },
                {
                  sheetName: 'نسخ الكتاب',
                  rows: copyRows.map((r) => ({
                    'رقم النسخة': r.copy.copyCode,
                    'الحالة': r.copy.status,
                    'الموقع': r.copy.shelfLocation,
                    'الطالب الحالي': r.borrower?.fullName || '—',
                    'المجموعة': r.borrower?.groupName || '—',
                  })),
                },
              ]);
              showToast('تم تصدير تقرير الكتاب إلى ملف Excel بنجاح 📊', 'success');
            }}
          >
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="w-3.5 h-3.5" />}
            onClick={() => printOfficialReport(buildBookReportPayload(), reportSettings)}
          >
            طباعة التقرير
          </Button>
        </div>
      </div>

      {/* 1. Hero Book Header + Cover + Visual Availability Bar + Smart Shortcuts */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Book Cover */}
          <div className="w-32 h-44 sm:w-36 sm:h-52 rounded-2xl overflow-hidden bg-gradient-to-tr from-wathba-900 to-wathba-600 text-white flex items-center justify-center shadow-card shrink-0 mx-auto lg:mx-0 border border-slate-200">
            {liveBook.coverImageUrl ? (
              <img
                src={liveBook.coverImageUrl}
                alt={liveBook.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <BookOpen className="w-12 h-12 text-wathba-100" />
            )}
          </div>

          {/* Info & Shortcuts */}
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-wathba-50 text-wathba-800 border border-wathba-200">
                    {liveBook.code}
                  </span>
                  {category && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                      {category.name}
                    </span>
                  )}
                  {liveBook.ageGroup && (
                    <span className="text-xs px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                      {liveBook.ageGroup}
                    </span>
                  )}
                  {liveBook.pageCount && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {liveBook.pageCount} صفحة
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-black text-slate-900 leading-snug">{liveBook.title}</h1>
                <p className="text-xs text-slate-600 mt-1">
                  المؤلف: <strong>{liveBook.author || '-'}</strong>
                  {liveBook.publisher && (
                    <span className="mr-3">• دار النشر: <strong>{liveBook.publisher}</strong></span>
                  )}
                </p>
              </div>

              {isHighDemand && (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>طلب مرتفع — يوصى بشراء نسخ إضافية</span>
                </span>
              )}
            </div>

            {liveBook.description && (
              <p className="text-xs text-slate-600 leading-relaxed">{liveBook.description}</p>
            )}

            {/* Visual Distribution Bar */}
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                <span className="text-slate-700">توزيع حالة النسخ الحالية:</span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-700">متاحة: {availPct}% ({availableCopies.length})</span>
                  <span className="text-blue-700">مستعارة: {borrowedPct}% ({currentlyBorrowedCopies.length})</span>
                  <span className="text-slate-500">أخرى (فحص/تلف/حجز): {otherPct}%</span>
                </div>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${availPct}%` }} />
                <div className="bg-blue-500 h-full transition-all" style={{ width: `${borrowedPct}%` }} />
                <div className="bg-amber-400 h-full transition-all" style={{ width: `${otherPct}%` }} />
              </div>
            </div>

            {/* 7 Smart Shortcuts */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAddCopyPromptOpen(true)}>
                إضافة نسخة جديدة
              </Button>
              <Button size="sm" variant="royal" icon={<Printer className="w-3.5 h-3.5" />} onClick={() => setPrintBarcodesOpen(true)}>
                طباعة باركود النسخ
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<Layers className="w-3.5 h-3.5" />}
                onClick={() => {
                  setActiveTab('copies');
                  setStatusFilter('all');
                }}
              >
                عرض جميع النسخ
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<User className="w-3.5 h-3.5" />}
                onClick={() => {
                  setActiveTab('copies');
                  setStatusFilter('borrowed');
                }}
              >
                عرض الإعارات الحالية
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<History className="w-3.5 h-3.5" />}
                onClick={() => setActiveTab('timeline')}
              >
                عرض سجل الإعارات والحركة
              </Button>
              <Button size="sm" variant="outline" icon={<Edit className="w-3.5 h-3.5" />} onClick={() => setEditBookOpen(true)}>
                تعديل بيانات الكتاب
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. تنبيهات إدارة النسخ الذكية (Section 3.6) */}
      {smartAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {smartAlerts.map((al, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-2xl border flex items-center gap-3 text-xs font-bold ${
                al.type === 'danger'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : al.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-wathba-50 border-wathba-200 text-wathba-900'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{al.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. لوحة إحصائيات الكتاب — الإحصائيات الأساسية السبعة الدقيقة */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <h3 className="font-black text-slate-900 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#3b707d]" />
            <span>لوحة إحصائيات استعارة الكتاب وحركة القراءة</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            النسخ المتاحة حالياً: <strong className="text-emerald-700">{availableCopies.length} من {totalCopiesCount}</strong>
          </span>
        </div>

        {/* شبكة الإحصائيات السبعة الأساسية المطلوبة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block leading-snug">
              1. إجمالي مرات الاستعارة
            </span>
            <strong className="text-xl font-black text-[#1c353d] mt-1 block">
              {totalLoansCount}
            </strong>
            <span className="text-[9px] text-slate-400">منذ إضافة الكتاب</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-blue-900 block leading-snug">
              2. الاستعارات الحالية
            </span>
            <strong className="text-xl font-black text-blue-800 mt-1 block">
              {currentActiveLoansCount}
            </strong>
            <span className="text-[9px] text-blue-700/80">نسخ لدى الطلاب</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-900 block leading-snug">
              3. إعارات مكتملة تاريخياً
            </span>
            <strong className="text-xl font-black text-emerald-800 mt-1 block">
              {historicalReturnedLoansCount}
            </strong>
            <span className="text-[9px] text-emerald-700/80">تم إرجاعها للمكتبة</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#e3ecf3]/70 border border-[#3b707d]/20 shadow-xs">
            <span className="text-[10px] font-bold text-[#1c353d] block leading-snug">
              4. الطلاب المستعيرون
            </span>
            <strong className="text-xl font-black text-[#2c5661] mt-1 block">
              {uniqueBorrowersCount}
            </strong>
            <span className="text-[9px] text-slate-500">طلاب مختلفون</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-purple-900 block leading-snug">
              5. مرات إكمال القراءة
            </span>
            <strong className="text-xl font-black text-purple-800 mt-1 block">
              {bookApprovedCompletionsCount}
            </strong>
            <span className="text-[9px] text-purple-700/80">معتمدة من المشرف</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-600 block leading-snug">
              6. إعادة استعارة الطالب
            </span>
            <strong className="text-xl font-black text-slate-800 mt-1 block">
              {repeatBorrowCount}
            </strong>
            <span className="text-[9px] text-slate-400">استعارات متكررة</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200/80 shadow-xs">
            <span className="text-[10px] font-bold text-rose-900 block leading-snug">
              7. التأخر في الإرجاع
            </span>
            <strong className="text-xl font-black text-rose-800 mt-1 block">
              {overdueLoansCount}
            </strong>
            <span className="text-[9px] text-rose-700/80">تجاوزت التاريخ المحدد</span>
          </div>
        </div>
      </div>

      {/* 4. بطاقات الطلاب المستعيرين حالياً + آخر النشاطات (Section 4.2 & 4.3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Borrowers Cards */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-3">
          <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <span>الطلاب المستعيرون للكتاب حالياً ({activeBookLoans.length})</span>
          </h4>
          {activeBookLoans.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-2xl text-xs text-slate-400">
              لا توجد نسخ مستعارة لدى الطلاب حالياً
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeBookLoans.map((l) => {
                const stu = students.find((s) => s.id === l.studentId);
                const cp = bookCopies.find((c) => c.id === l.copyId);
                const cd = getLoanCountdown(l.dueDate);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => stu && onNavigateToStudentReport?.(stu.id)}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-wathba-50/50 hover:border-wathba-300 transition-all text-right space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-xs text-slate-900">{stu?.fullName || '-'}</strong>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${cd.badgeColorClass}`}>
                        {cd.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {stu?.groupName} • نسخة <span className="font-mono font-bold">{cp?.copyCode}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      الاستعارة: {formatArabicDate(l.loanDate)} • الإرجاع: {formatArabicDate(l.dueDate)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activities Box */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-3">
          <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-wathba-600" />
            <span>آخر النشاطات على الكتاب</span>
          </h4>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {sortedTimeline.slice(0, 6).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div>
                  <strong className="text-slate-900">{ev.title}</strong>
                  <span className="block text-[11px] text-slate-500">
                    {ev.actor} • {ev.description}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {formatArabicDate(ev.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. التبويبات المنظمة للكتاب: سجل الاستعارات | نسخ الكتاب | السجل الزمني | إحصائيات الطلب */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-soft">
        <button
          type="button"
          onClick={() => setActiveTab('loans_history')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'loans_history' ? 'bg-[#3b707d] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>سجل استعارات وحركة الكتاب ({bookLoansAll.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('copies')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'copies' ? 'bg-[#3b707d] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>نسخ الكتاب ({bookCopies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'timeline' ? 'bg-[#3b707d] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>السجل الزمني للأحداث ({sortedTimeline.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activeTab === 'analytics' ? 'bg-[#3b707d] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>إحصائيات الطلب والتحليلات</span>
        </button>
      </div>

      {/* TAB 0: جدول سجل جميع عمليات الاستعارة السابقة وحركة الكتاب بالكامل */}
      {activeTab === 'loans_history' && (
        <div className="space-y-4">
          {/* شريط الفلاتر والبحث في سجل الاستعارات */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center gap-3 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث باسم الطالب، الرمز، المشرف، أو كود النسخة..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#3b707d] outline-none"
              />
            </div>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
              <option value="all">جميع المجموعات</option>
              {uniqueLoanGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
              <option value="all">جميع حالات الإعارة</option>
              <option value="active">مستعارة حالياً (نشطة)</option>
              <option value="returned">معادة ومكتملة</option>
              <option value="overdue">متأخرة عن الموعد</option>
            </select>

            <select
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
              <option value="all">جميع حالات القراءة</option>
              <option value="completed">إكمال معتمد ومكتمل</option>
              <option value="pending">بانتظار اعتماد المشرف</option>
              <option value="none">لم يُسجل إكمال بعد</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200"
              title="من تاريخ الاستعارة"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200"
              title="إلى تاريخ الاستعارة"
            />
          </div>

          {/* جدول تفاصيل حركة واستعارات الكتاب */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#3b707d]" />
                <span>سجل حركة واستعارات الكتاب ({filteredLoanHistoryRows.length} عملية موثقة)</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                إجمالي الاستعارات: {bookLoansAll.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">اسم الطالب</th>
                    <th className="p-3.5">المجموعة</th>
                    <th className="p-3.5">المشرف المسؤول</th>
                    <th className="p-3.5">تاريخ الاستعارة</th>
                    <th className="p-3.5">تاريخ الإرجاع المتوقع</th>
                    <th className="p-3.5">تاريخ الإرجاع الفعلي</th>
                    <th className="p-3.5 text-center">حالة الإعارة</th>
                    <th className="p-3.5 text-center">هل أكمل الطالب قراءة الكتاب؟</th>
                    <th className="p-3.5">تاريخ اعتماد الإكمال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoanHistoryRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        لا توجد عمليات استعارة مطابقة للبحث أو الفلاتر المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredLoanHistoryRows.map((row) => {
                      const isComplete = row.completion?.status === 'approved';
                      const isPending = row.completion?.status === 'pending_approval';

                      return (
                        <tr key={row.loan.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900">
                            <div>{row.student?.fullName || 'طالب غير محدد'}</div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{row.student?.internalId || '—'}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-600">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">
                              {row.student?.groupName || 'المجموعة العامة'}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-700 font-medium">
                            {row.supervisor?.fullName || '—'}
                          </td>

                          <td className="p-3.5 font-mono text-slate-700">
                            {formatArabicDate(row.loan.loanDate)}
                          </td>

                          <td className="p-3.5 font-mono text-slate-600">
                            {formatArabicDate(row.loan.dueDate)}
                          </td>

                          <td className="p-3.5 font-mono">
                            {row.loan.returnDate ? (
                              <span className="text-emerald-700 font-bold">
                                {formatArabicDate(row.loan.returnDate)}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                                مستعارة حالياً
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-center">
                            <Badge status={row.loan.status} size="sm" />
                          </td>

                          <td className="p-3.5 text-center">
                            {isComplete ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-[11px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>نعم، مكتمل ومعتمد</span>
                              </span>
                            ) : isPending ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px] inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>بانتظار الاعتماد</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium text-[11px]">
                                لم يُسجل إكمال
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 font-mono text-slate-600">
                            {row.completion?.approvedAt ? (
                              <span className="text-[#2c5661] font-bold">
                                {formatArabicDate(row.completion.approvedAt)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
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
        </div>
      )}

      {/* TAB 1: جدول جميع نسخ الكتاب (Section 3.2) */}
      {activeTab === 'copies' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center gap-3 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث برقم النسخة، الرف، أو اسم الطالب..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-wathba-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
              <option value="all">جميع الحالات</option>
              <option value="available">متاحة</option>
              <option value="borrowed">مستعارة</option>
              <option value="reserved">محجوزة</option>
              <option value="under_inspection">قيد الفحص</option>
              <option value="damaged">متضررة</option>
              <option value="lost">مفقودة</option>
            </select>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
              <option value="all">جميع المجموعات</option>
              {uniqueGroupsForFilter.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
            >
              <option value="all">جميع الطلاب</option>
              {uniqueBorrowersForFilter.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200"
              title="من تاريخ الاستعارة"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200"
              title="إلى تاريخ الاستعارة"
            />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-between">
              <span>جميع نسخ الكتاب ({filteredCopyRows.length}) — اضغط على أي نسخة لفتح سجلها الكامل</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">رقم النسخة</th>
                    <th className="p-3.5">QR</th>
                    <th className="p-3.5">حالة النسخة</th>
                    <th className="p-3.5">الطالب الحالي</th>
                    <th className="p-3.5">المجموعة</th>
                    <th className="p-3.5">المشرف</th>
                    <th className="p-3.5">تاريخ الاستعارة</th>
                    <th className="p-3.5">موعد الإرجاع</th>
                    <th className="p-3.5">تاريخ الإرجاع</th>
                    <th className="p-3.5 text-center">سجل النسخة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCopyRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-10 text-center text-slate-400">
                        لا توجد نسخ تطابق معايير البحث
                      </td>
                    </tr>
                  ) : (
                    filteredCopyRows.map((row) => (
                      <tr
                        key={row.copy.id}
                        onClick={() => setSelectedCopyDetail(row.copy)}
                        className="hover:bg-wathba-50/40 cursor-pointer transition-colors"
                      >
                        <td className="p-3.5 font-mono font-black text-slate-900">
                          {row.copy.copyCode}
                          <span className="block text-[10px] font-arabic font-normal text-slate-400">
                            {row.copy.shelfLocation}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px]">
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR</span>
                          </span>
                        </td>
                        <td className="p-3.5">
                          <Badge status={row.copy.status} size="sm" />
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {row.borrower ? (
                            <span className="text-blue-800 font-black">{row.borrower.fullName}</span>
                          ) : (
                            <span className="text-emerald-700">متاحة للاستعارة</span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-600">{row.borrower?.groupName || '—'}</td>
                        <td className="p-3.5 text-slate-600">{row.supervisor?.fullName || '—'}</td>
                        <td className="p-3.5 text-slate-600">
                          {row.activeLoan
                            ? formatArabicDate(row.activeLoan.loanDate)
                            : row.latestReturnedLoan
                            ? formatArabicDate(row.latestReturnedLoan.loanDate)
                            : '—'}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {row.activeLoan ? formatArabicDate(row.activeLoan.dueDate) : '—'}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          {row.latestReturnedLoan?.returnDate
                            ? formatArabicDate(row.latestReturnedLoan.returnDate)
                            : '—'}
                        </td>
                        <td className="p-3.5 text-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCopyDetail(row.copy);
                            }}
                          >
                            عرض السجل
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: سجل حركة الكتاب بالكامل Timeline (Section 3.4) */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-4">
          <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-wathba-600" />
            <span>السجل الزمني لحركة الكتاب ونسخه ({sortedTimeline.length} حدث)</span>
          </h3>

          <div className="relative border-r-2 border-wathba-200 mr-4 pr-6 space-y-5">
            {sortedTimeline.map((ev) => (
              <div key={ev.id} className="relative">
                <div className="absolute -right-[31px] top-1 w-3.5 h-3.5 rounded-full bg-wathba-600 border-2 border-white shadow-xs" />
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-sm">{ev.title}</strong>
                      <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-wathba-800">
                        المسؤول: {ev.actor}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatArabicDateTime(ev.date)}
                    </span>
                  </div>
                  <p className="text-slate-600">{ev.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: إحصائيات الطلب والتحليلات (Section 3.5) */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
              <span className="text-[11px] font-bold text-slate-500 block">متوسط مدة بقاء الكتاب مع الطالب</span>
              <strong className="text-2xl font-black text-wathba-800 mt-1 block">{avgLoanDays} يوم</strong>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
              <span className="text-[11px] font-bold text-slate-500 block">نسبة النسخ المستخدمة</span>
              <strong className="text-2xl font-black text-emerald-700 mt-1 block">{utilizationRatio}%</strong>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
              <span className="text-[11px] font-bold text-slate-500 block">عدد مرات الحجز</span>
              <strong className="text-2xl font-black text-amber-700 mt-1 block">{bookReservations.length}</strong>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
              <span className="text-[11px] font-bold text-slate-500 block">طلبات المناقشة للكتاب</span>
              <strong className="text-2xl font-black text-purple-700 mt-1 block">{bookDiscussions.length}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <VerticalColumnChart
              title="أكثر الفترات استعارة للكتاب"
              data={periodDemandChart}
              unit="استعارة"
              color="#3b707d"
            />
            <HorizontalBarChart
              title="أكثر المجموعات استعارة للكتاب"
              data={groupDemandChart}
              unit="مرة"
              accentColor="#059669"
            />
            <HorizontalBarChart
              title="أكثر الطلاب قراءة واستعارة للكتاب"
              data={topBookReaders}
              unit="مرة"
              accentColor="#026bc9"
            />
          </div>
        </div>
      )}

      {/* Copy Detail Modal */}
      {selectedCopyDetail && (
        <CopyDetailModal
          isOpen={!!selectedCopyDetail}
          onClose={() => setSelectedCopyDetail(null)}
          copy={selectedCopyDetail}
          book={liveBook}
          onSelectStudent={(stuId) => {
            setSelectedCopyDetail(null);
            onNavigateToStudentReport?.(stuId);
          }}
        />
      )}

      {/* Edit Book Modal */}
      {editBookOpen && (
        <EditBookModal
          isOpen={editBookOpen}
          onClose={() => setEditBookOpen(false)}
          book={liveBook}
          categories={categories}
          onUpdateBook={(updated) => {
            updateBook(updated);
            showToast('تم تحديث بيانات الكتاب بنجاح', 'success');
          }}
        />
      )}

      {/* Print Barcodes Modal */}
      {printBarcodesOpen && (
        <Modal
          isOpen={printBarcodesOpen}
          onClose={() => setPrintBarcodesOpen(false)}
          title={`طباعة باركود نسخ: ${liveBook.title}`}
          maxWidth="4xl"
        >
          <BookLabelPrintSheet
            copies={bookCopies}
            books={[liveBook]}
            onClose={() => setPrintBarcodesOpen(false)}
          />
        </Modal>
      )}

      {/* Add Copy Quick Modal */}
      {addCopyPromptOpen && (
        <Modal
          isOpen={addCopyPromptOpen}
          onClose={() => setAddCopyPromptOpen(false)}
          title={`إضافة نسخة جديدة لـ: ${liveBook.title}`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">موقع الرف:</label>
              <input
                type="text"
                value={newCopyShelf}
                onChange={(e) => setNewCopyShelf(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setAddCopyPromptOpen(false)}>
                إلغاء
              </Button>
              <Button size="sm" variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleAddNewCopy}>
                توليد وإضافة النسخة
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
