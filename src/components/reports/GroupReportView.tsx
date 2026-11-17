import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { ReportPeriodPreset } from '../../types';
import { formatArabicDate, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { resolveReportPeriod, isTimestampInRange } from '../../lib/reportPeriodUtils';
import {
  isDiscussionCompletedOrApproved,
  filterStudentsForStaffScope,
} from '../../lib/discussionUtils';
import {
  downloadOfficialReportPdf,
  exportStructuredExcelReport,
  printOfficialReport,
  OfficialReportPayload,
} from '../../lib/reportExportUtils';
import { HorizontalBarChart, VerticalColumnChart, DonutMetricCard } from './ReportCharts';
import { Button } from '../common/Button';
import {
  Users,
  BookOpen,
  Award,
  Download,
  Printer,
  FileSpreadsheet,
  Save,
  TrendingUp,
  AlertCircle,
  MessageSquareText,
  ArrowUpDown,
  ChevronLeft,
} from 'lucide-react';

interface GroupReportViewProps {
  onSelectStudent: (studentId: string) => void;
}

export const GroupReportView: React.FC<GroupReportViewProps> = ({ onSelectStudent }) => {
  const { currentStaff } = useAuth();
  const {
    students,
    staff,
    books,
    copies,
    categories,
    loans,
    readingLogs,
    discussions,
    reportSettings,
    groupReportSummaries,
    saveGroupReportSummary,
    getStudentRankSummary,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const scopedStudents = filterStudentsForStaffScope(students, liveStaff);
  const availableGroups = Array.from(new Set(scopedStudents.map((s) => s.groupName).filter(Boolean)));

  const [selectedGroup, setSelectedGroup] = useState<string>(availableGroups[0] || 'all');
  const [periodPreset, setPeriodPreset] = useState<ReportPeriodPreset>(reportSettings.defaultPeriod || 'all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortKey, setSortKey] = useState<'pages' | 'points' | 'loans' | 'discussions' | 'name'>('pages');
  const [exportingPdf, setExportingPdf] = useState(false);

  const period = resolveReportPeriod(periodPreset, customFrom, customTo);
  const effectiveGroupName = selectedGroup === 'all' ? 'جميع المجموعات' : selectedGroup;

  // Editable supervisor summary state
  const existingSummary = groupReportSummaries.find(
    (g) => g.groupName === effectiveGroupName && g.periodKey === period.key
  );
  const [keyAchievements, setKeyAchievements] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [difficulties, setDifficulties] = useState('');
  const [studentsNeedingFollowUp, setStudentsNeedingFollowUp] = useState('');
  const [recommendations, setRecommendations] = useState('');

  useEffect(() => {
    setKeyAchievements(existingSummary?.keyAchievements || '');
    setGeneralNotes(existingSummary?.generalNotes || '');
    setDifficulties(existingSummary?.difficulties || '');
    setStudentsNeedingFollowUp(existingSummary?.studentsNeedingFollowUp || '');
    setRecommendations(existingSummary?.recommendations || '');
  }, [effectiveGroupName, period.key, existingSummary?.updatedAt]);

  // Group Students & Responsible Supervisor
  const groupStudents =
    selectedGroup === 'all'
      ? scopedStudents
      : scopedStudents.filter((s) => s.groupName === selectedGroup);
  const groupStudentIds = new Set(groupStudents.map((s) => s.id));

  const assignedSupervisor =
    staff.find(
      (st) =>
        st.role === 'supervisor' &&
        st.assignedGroups &&
        selectedGroup !== 'all' &&
        st.assignedGroups.includes(selectedGroup)
    ) ||
    staff.find((st) => st.role === 'supervisor') ||
    liveStaff ||
    staff[0];

  // Filtered dataset for period
  const groupLoansAll = loans.filter((l) => groupStudentIds.has(l.studentId) && l.status !== 'cancelled');
  const groupLoansPeriod = groupLoansAll.filter((l) =>
    isTimestampInRange(l.loanDate, period.startMs, period.endMs)
  );
  const groupReturnedPeriod = groupLoansAll.filter(
    (l) => l.status === 'returned' && isTimestampInRange(l.returnDate || l.loanDate, period.startMs, period.endMs)
  );
  const groupActiveLoansNow = groupLoansAll.filter((l) => l.status === 'active' || l.status === 'overdue');

  const groupApprovedLogsPeriod = readingLogs.filter(
    (l) =>
      groupStudentIds.has(l.studentId) &&
      l.status === 'approved' &&
      isTimestampInRange(l.reviewedAt || l.readingDate || l.createdAt, period.startMs, period.endMs)
  );
  const totalApprovedPages = groupApprovedLogsPeriod.reduce(
    (sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount),
    0
  );

  const groupDiscussionsPeriod = discussions.filter(
    (d) =>
      groupStudentIds.has(d.studentId) &&
      isTimestampInRange(d.discussionDate || d.requestDate, period.startMs, period.endMs)
  );
  const discussedInPeriod = groupDiscussionsPeriod.filter((d) => isDiscussionCompletedOrApproved(d));
  const approvedDiscussionsPeriod = groupDiscussionsPeriod.filter((d) => d.status === 'approved');
  const totalPointsPeriod = approvedDiscussionsPeriod.reduce(
    (sum, d) => sum + (Number(d.pointsAwarded) || 0),
    0
  );

  const avgPagesPerStudent =
    groupStudents.length > 0 ? Math.round(totalApprovedPages / groupStudents.length) : 0;
  const avgDiscussionScore =
    discussedInPeriod.length > 0
      ? Math.round(
          discussedInPeriod.reduce((sum, d) => sum + d.totalScore, 0) / discussedInPeriod.length
        )
      : 0;

  // Count completed books in period (student-book pairs with approved pages >= book.pageCount)
  const completedBookPairs = new Set<string>();
  const bookCompletedCounts = new Map<string, number>();
  const pagesByStuBook = new Map<string, number>();
  groupApprovedLogsPeriod.forEach((l) => {
    const key = `${l.studentId}::${l.bookId}`;
    pagesByStuBook.set(key, (pagesByStuBook.get(key) || 0) + (l.correctedPagesCount ?? l.pagesCount));
  });
  pagesByStuBook.forEach((pagesSum, key) => {
    const [, bookId] = key.split('::');
    const b = books.find((bk) => bk.id === bookId);
    const target = b?.pageCount && b.pageCount > 0 ? b.pageCount : 100;
    if (pagesSum >= target) {
      completedBookPairs.add(key);
      bookCompletedCounts.set(bookId, (bookCompletedCounts.get(bookId) || 0) + 1);
    }
  });

  // Per-student metrics table
  const studentRows = groupStudents
    .map((stu) => {
      const sLoans = groupLoansPeriod.filter((l) => l.studentId === stu.id);
      const sLogs = groupApprovedLogsPeriod.filter((l) => l.studentId === stu.id);
      const sPages = sLogs.reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
      const sCompletedCount = Array.from(completedBookPairs).filter((k) =>
        k.startsWith(`${stu.id}::`)
      ).length;
      const sDiscs = groupDiscussionsPeriod.filter((d) => d.studentId === stu.id);
      const sDiscDone = sDiscs.filter((d) => isDiscussionCompletedOrApproved(d));
      const sDiscApproved = sDiscs.filter((d) => d.status === 'approved');
      const sPoints = sDiscApproved.reduce((sum, d) => sum + (Number(d.pointsAwarded) || 0), 0);
      const sAvgScore =
        sDiscDone.length > 0
          ? Math.round(sDiscDone.reduce((sum, d) => sum + d.totalScore, 0) / sDiscDone.length)
          : 0;
      const rankSummary = getStudentRankSummary(stu.id);

      const activityDates = [
        ...sLoans.map((l) => l.loanDate),
        ...sLogs.map((l) => l.reviewedAt || l.createdAt),
        ...sDiscs.map((d) => d.updatedAt),
      ]
        .filter(Boolean)
        .map((d) => new Date(d).getTime())
        .filter((t) => !isNaN(t));
      const lastActivityMs = activityDates.length > 0 ? Math.max(...activityDates) : 0;

      return {
        student: stu,
        loansCount: sLoans.length,
        completedCount: sCompletedCount,
        pagesCount: sPages,
        discussionsCount: sDiscDone.length,
        avgScore: sAvgScore,
        pointsCount: sPoints,
        currentRankTitle: rankSummary.currentRank?.title || 'بدون لقب بعد',
        earnedRanksCount: rankSummary.tiers.filter((t) => t.status === 'earned').length,
        lastActivityIso: lastActivityMs > 0 ? new Date(lastActivityMs).toISOString() : undefined,
        isActiveReader: sLogs.length > 0 || sLoans.length > 0 || sDiscDone.length > 0,
      };
    })
    .sort((a, b) => {
      if (sortKey === 'pages') return b.pagesCount - a.pagesCount;
      if (sortKey === 'points') return b.pointsCount - a.pointsCount;
      if (sortKey === 'loans') return b.loansCount - a.loansCount;
      if (sortKey === 'discussions') return b.discussionsCount - a.discussionsCount;
      return a.student.fullName.localeCompare(b.student.fullName, 'ar');
    });

  const activeReadersCount = studentRows.filter((r) => r.pagesCount > 0 || r.loansCount > 0).length;
  const inactiveReadersCount = Math.max(0, groupStudents.length - activeReadersCount);
  const readingParticipationPct =
    groupStudents.length > 0 ? Math.round((activeReadersCount / groupStudents.length) * 100) : 0;
  const studentsWithDiscussionsCount = studentRows.filter((r) => r.discussionsCount > 0).length;
  const discussionParticipationPct =
    groupStudents.length > 0
      ? Math.round((studentsWithDiscussionsCount / groupStudents.length) * 100)
      : 0;

  // Performance Analytics
  const topReaders = [...studentRows].sort((a, b) => b.pagesCount - a.pagesCount).slice(0, 5);
  const topDiscussers = [...studentRows]
    .sort((a, b) => b.discussionsCount - a.discussionsCount)
    .slice(0, 5);
  const topRankProgress = [...studentRows]
    .sort((a, b) => b.earnedRanksCount - a.earnedRanksCount || b.pagesCount - a.pagesCount)
    .slice(0, 5);
  const needsEncouragement = studentRows.filter(
    (r) => r.pagesCount === 0 || (r.loansCount > 0 && r.discussionsCount === 0)
  );

  // Books & Categories Demand
  const bookLoanMap = new Map<string, number>();
  const categoryLoanMap = new Map<string, number>();
  groupLoansPeriod.forEach((l) => {
    const c = copies.find((cp) => cp.id === l.copyId);
    if (!c) return;
    bookLoanMap.set(c.bookId, (bookLoanMap.get(c.bookId) || 0) + 1);
    const bk = books.find((b) => b.id === c.bookId);
    if (bk?.categoryId) {
      categoryLoanMap.set(bk.categoryId, (categoryLoanMap.get(bk.categoryId) || 0) + 1);
    }
  });

  const topBorrowedBooks = Array.from(bookLoanMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bookId, count]) => ({
      title: books.find((b) => b.id === bookId)?.title || bookId,
      count,
    }));

  const topCompletedBooks = Array.from(bookCompletedCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bookId, count]) => ({
      title: books.find((b) => b.id === bookId)?.title || bookId,
      count,
    }));

  const topCategories = Array.from(categoryLoanMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([catId, count]) => ({
      name: categories.find((c) => c.id === catId)?.name || 'تصنيف عام',
      count,
    }));

  // Period Comparison (Current vs Previous Period)
  const cmpCurrentStart =
    period.startMs ?? (period.prevEndMs ? period.prevEndMs + 1 : Date.now() - 30 * 86400000);
  const cmpCurrentEnd = period.endMs ?? Date.now();
  const prevLoansCount = groupLoansAll.filter((l) =>
    isTimestampInRange(l.loanDate, period.prevStartMs, period.prevEndMs)
  ).length;
  const currLoansForCmp = groupLoansAll.filter((l) =>
    isTimestampInRange(l.loanDate, cmpCurrentStart, cmpCurrentEnd)
  ).length;
  const prevPagesCount = readingLogs
    .filter(
      (l) =>
        groupStudentIds.has(l.studentId) &&
        l.status === 'approved' &&
        isTimestampInRange(l.reviewedAt || l.readingDate || l.createdAt, period.prevStartMs, period.prevEndMs)
    )
    .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
  const currPagesForCmp = readingLogs
    .filter(
      (l) =>
        groupStudentIds.has(l.studentId) &&
        l.status === 'approved' &&
        isTimestampInRange(l.reviewedAt || l.readingDate || l.createdAt, cmpCurrentStart, cmpCurrentEnd)
    )
    .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);
  const prevDiscCount = discussions.filter(
    (d) =>
      groupStudentIds.has(d.studentId) &&
      d.status === 'approved' &&
      isTimestampInRange(d.approvedAt || d.discussionDate || d.requestDate, period.prevStartMs, period.prevEndMs)
  ).length;
  const currDiscForCmp = discussions.filter(
    (d) =>
      groupStudentIds.has(d.studentId) &&
      d.status === 'approved' &&
      isTimestampInRange(d.approvedAt || d.discussionDate || d.requestDate, cmpCurrentStart, cmpCurrentEnd)
  ).length;

  const handleSaveSupervisorSummary = () => {
    if (!liveStaff) return;
    saveGroupReportSummary({
      groupName: effectiveGroupName,
      periodKey: period.key,
      supervisorId: liveStaff.id,
      supervisorName: liveStaff.fullName,
      keyAchievements,
      generalNotes,
      difficulties,
      studentsNeedingFollowUp,
      recommendations,
    });
    showToast('تم حفظ ملخص المشرف وتوصيات المجموعة بنجاح ✅', 'success');
  };

  const buildOfficialPayload = (): OfficialReportPayload => ({
    reportTitle: `تقرير أداء المجموعة: ${effectiveGroupName}`,
    subtitle: `تقرير تفصيلي لحركة القراءة والاستعارة والمناقشات والنقاط`,
    periodLabel: period.label,
    supervisorName: assignedSupervisor?.fullName || liveStaff?.fullName,
    metadata: [
      { label: 'اسم المجموعة', value: effectiveGroupName },
      { label: 'المشرف المسؤول', value: assignedSupervisor?.fullName || 'غير محدد' },
      { label: 'عدد الطلاب', value: `${groupStudents.length} طالب` },
      { label: 'الفترة الزمنية', value: period.label },
      { label: 'نسبة مشاركة القراءة', value: `${readingParticipationPct}%` },
      { label: 'نسبة مشاركة المناقشات', value: `${discussionParticipationPct}%` },
    ],
    kpis: [
      { label: 'إجمالي الكتب المستعارة', value: groupLoansPeriod.length },
      { label: 'الكتب المعادة', value: groupReturnedPeriod.length },
      { label: 'المستعارة حالياً', value: groupActiveLoansNow.length },
      { label: 'إجمالي الصفحات المعتمدة', value: totalApprovedPages },
      { label: 'كتب تمت قراءتها', value: completedBookPairs.size },
      { label: 'المناقشات المعتمدة', value: approvedDiscussionsPeriod.length },
      { label: 'متوسط درجات المناقشة', value: `${avgDiscussionScore}%` },
      { label: 'مجموع النقاط', value: totalPointsPeriod },
    ],
    charts: reportSettings.groupSections.charts
      ? [
          {
            title: 'أكثر الطلاب قراءة (صفحات معتمدة)',
            bars: topReaders.map((r) => ({
              label: r.student.fullName,
              value: r.pagesCount,
              unit: 'صفحة',
            })),
          },
          {
            title: 'أكثر الكتب استعارة في المجموعة',
            bars: topBorrowedBooks.map((b) => ({
              label: b.title,
              value: b.count,
              unit: 'استعارة',
            })),
          },
        ]
      : [],
    tables: reportSettings.groupSections.studentsTable
      ? [
          {
            title: 'جدول تفاصيل طلاب المجموعة',
            columns: [
              'اسم الطالب',
              'المستعارة',
              'المكتملة',
              'الصفحات',
              'المناقشات',
              'متوسط الدرجات',
              'النقاط',
              'اللقب القرائي',
              'آخر نشاط',
            ],
            rows: studentRows.map((r) => [
              r.student.fullName,
              r.loansCount,
              r.completedCount,
              r.pagesCount,
              r.discussionsCount,
              `${r.avgScore}%`,
              r.pointsCount,
              r.currentRankTitle,
              r.lastActivityIso ? formatArabicDate(r.lastActivityIso) : '—',
            ]),
          },
        ]
      : [],
    notesBlocks: reportSettings.groupSections.supervisorSummary
      ? [
          {
            title: 'ملخص وتوصيات المشرف المسؤول',
            items: [
              { label: 'أبرز الإنجازات', value: keyAchievements },
              { label: 'الملاحظات العامة', value: generalNotes },
              { label: 'الصعوبات والتحديات', value: difficulties },
              { label: 'طلاب يحتاجون إلى متابعة', value: studentsNeedingFollowUp },
              { label: 'التوصيات للفترة القادمة', value: recommendations },
            ],
          },
        ]
      : [],
  });

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await downloadOfficialReportPdf(
        buildOfficialPayload(),
        reportSettings,
        `تقرير_مجموعة_${effectiveGroupName}`
      );
      showToast('تم تصدير تقرير المجموعة بصيغة PDF بنجاح 📄', 'success');
    } catch (err: any) {
      showToast(err?.message || 'تعذر إنشاء ملف PDF', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    exportStructuredExcelReport(`تقرير_مجموعة_${effectiveGroupName}`, [
      {
        sheetName: 'ملخص المجموعة',
        rows: [
          { البيان: 'اسم المجموعة', القيمة: effectiveGroupName },
          { البيان: 'المشرف المسؤول', القيمة: assignedSupervisor?.fullName || '-' },
          { البيان: 'عدد الطلاب', القيمة: groupStudents.length },
          { البيان: 'الفترة الزمنية', القيمة: period.label },
          { البيان: 'إجمالي الكتب المستعارة', القيمة: groupLoansPeriod.length },
          { البيان: 'إجمالي الكتب المعادة', القيمة: groupReturnedPeriod.length },
          { البيان: 'الكتب المستعارة حالياً', القيمة: groupActiveLoansNow.length },
          { البيان: 'إجمالي الصفحات المعتمدة', القيمة: totalApprovedPages },
          { البيان: 'عدد الكتب المكتملة', القيمة: completedBookPairs.size },
          { البيان: 'عدد المناقشات المنجزة', القيمة: discussedInPeriod.length },
          { البيان: 'عدد المناقشات المعتمدة', القيمة: approvedDiscussionsPeriod.length },
          { البيان: 'متوسط صفحات القراءة لكل طالب', القيمة: avgPagesPerStudent },
          { البيان: 'متوسط درجات المناقشات', القيمة: `${avgDiscussionScore}%` },
          { البيان: 'مجموع النقاط', القيمة: totalPointsPeriod },
          { البيان: 'الطلاب النشطين قرائياً', القيمة: activeReadersCount },
          { البيان: 'طلاب لم يسجلوا قراءة', القيمة: inactiveReadersCount },
        ],
      },
      {
        sheetName: 'تفاصيل الطلاب',
        rows: studentRows.map((r) => ({
          'اسم الطالب': r.student.fullName,
          'الصف': r.student.grade,
          'المجموعة': r.student.groupName,
          'الكتب المستعارة': r.loansCount,
          'الكتب المكتملة': r.completedCount,
          'الصفحات المعتمدة': r.pagesCount,
          'المناقشات': r.discussionsCount,
          'متوسط درجات المناقشات': r.avgScore,
          'النقاط': r.pointsCount,
          'اللقب القرائي الحالي': r.currentRankTitle,
          'آخر نشاط': r.lastActivityIso ? formatArabicDate(r.lastActivityIso) : '—',
        })),
      },
      {
        sheetName: 'ملخص المشرف',
        rows: [
          { البند: 'أبرز الإنجازات', المحتوى: keyAchievements || '—' },
          { البند: 'الملاحظات العامة', المحتوى: generalNotes || '—' },
          { البند: 'الصعوبات', المحتوى: difficulties || '—' },
          { البند: 'الطلاب المحتاجين للمتابعة', المحتوى: studentsNeedingFollowUp || '—' },
          { البند: 'التوصيات للفترة القادمة', المحتوى: recommendations || '—' },
        ],
      },
    ]);
    showToast('تم تصدير تقرير المجموعة بصيغة Excel منظم وقابل للتصفية 📊', 'success');
  };

  return (
    <div className="space-y-6">
      {/* 1. Filters & Actions Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">المجموعة:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 font-bold bg-slate-50 focus:ring-2 focus:ring-wathba-500"
            >
              <option value="all">جميع المجموعات ({scopedStudents.length} طالب)</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">الفترة الزمنية:</label>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as ReportPeriodPreset)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 font-bold bg-slate-50 focus:ring-2 focus:ring-wathba-500"
            >
              <option value="all">جميع الفترات</option>
              <option value="this_week">هذا الأسبوع</option>
              <option value="this_month">هذا الشهر</option>
              <option value="last_30_days">آخر 30 يوماً</option>
              <option value="this_term">الفصل الدراسي</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </div>

          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">من:</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">إلى:</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={exportingPdf}
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportPdf}
          >
            تصدير PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="w-4 h-4" />}
            onClick={handleExportExcel}
          >
            تصدير Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => printOfficialReport(buildOfficialPayload(), reportSettings)}
          >
            طباعة رسمية
          </Button>
        </div>
      </div>

      {/* 2. بيانات المجموعة */}
      {reportSettings.groupSections.groupInfo && (
        <div className="bg-gradient-to-l from-[#27434b] via-[#3b707d] to-[#325d68] text-white rounded-3xl p-6 shadow-card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-4">
            <div>
              <span className="text-xs font-bold text-gold-300 block">بيانات المجموعة والتقرير</span>
              <h3 className="text-2xl font-black mt-0.5">{effectiveGroupName}</h3>
              <p className="text-xs text-wathba-100 mt-1">
                المشرف المسؤول: <strong className="text-white">{assignedSupervisor?.fullName || 'غير محدد'}</strong> •
                الفترة: <strong className="text-white">{period.label}</strong>
              </p>
            </div>
            <div className="px-4 py-2 rounded-2xl bg-white/15 border border-white/20 text-center">
              <span className="text-[11px] text-wathba-100 block">عدد طلاب المجموعة</span>
              <strong className="text-2xl font-black text-gold-300">{groupStudents.length}</strong>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-[11px] text-wathba-100 block">إجمالي الكتب المستعارة</span>
              <strong className="text-2xl font-black">{groupLoansPeriod.length}</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-[11px] text-wathba-100 block">إجمالي الكتب المعادة</span>
              <strong className="text-2xl font-black text-emerald-300">{groupReturnedPeriod.length}</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-[11px] text-wathba-100 block">الكتب المستعارة حالياً</span>
              <strong className="text-2xl font-black text-sky-200">{groupActiveLoansNow.length}</strong>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15">
              <span className="text-[11px] text-wathba-100 block">إجمالي الصفحات المعتمدة</span>
              <strong className="text-2xl font-black text-gold-300">
                {totalApprovedPages.toLocaleString('ar-SA')}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 3. إحصائيات القراءة والمناقشات */}
      {reportSettings.groupSections.readingStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {[
            { label: 'الكتب التي تمت قراءتها', value: completedBookPairs.size, color: 'text-wathba-800' },
            { label: 'الكتب التي تمت مناقشتها', value: discussedInPeriod.length, color: 'text-indigo-700' },
            { label: 'المناقشات المعتمدة', value: approvedDiscussionsPeriod.length, color: 'text-emerald-700' },
            { label: 'متوسط الصفحات للطالب', value: avgPagesPerStudent, color: 'text-wathba-700' },
            { label: 'متوسط درجات المناقشات', value: `${avgDiscussionScore}%`, color: 'text-amber-700' },
            { label: 'مجموع النقاط المكتسبة', value: totalPointsPeriod, color: 'text-emerald-700' },
            { label: 'الطلاب النشطون قرائياً', value: activeReadersCount, color: 'text-sky-700' },
            { label: 'طلاب لم يسجلوا قراءة', value: inactiveReadersCount, color: 'text-rose-700' },
            { label: 'مجموع الصفحات المقروءة', value: totalApprovedPages, color: 'text-slate-900' },
            { label: 'نسبة مشاركة القراءة', value: `${readingParticipationPct}%`, color: 'text-wathba-800' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
              <span className="text-[11px] font-bold text-slate-500 block">{stat.label}</span>
              <strong className={`text-xl font-black mt-1 block ${stat.color}`}>
                {stat.value.toLocaleString('ar-SA')}
              </strong>
            </div>
          ))}
        </div>
      )}

      {/* 4. جدول تفاصيل الطلاب (قابل للنقر للانتقال للتقرير الفردي) */}
      {reportSettings.groupSections.studentsTable && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-sm text-slate-900">جدول تفاصيل طلاب المجموعة</h3>
              <p className="text-[11px] text-slate-500">
                اضغط على اسم أي طالب للانتقال مباشرة إلى تقريره الفردي التفصيلي
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold bg-white"
              >
                <option value="pages">الأكثر صفحات مقروءة</option>
                <option value="points">الأعلى نقاطاً</option>
                <option value="discussions">الأكثر مناقشة</option>
                <option value="loans">الأكثر استعارة</option>
                <option value="name">أبجدياً حسب الاسم</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3.5">اسم الطالب</th>
                  <th className="p-3.5 text-center">الكتب المستعارة</th>
                  <th className="p-3.5 text-center">الكتب المكتملة</th>
                  <th className="p-3.5 text-center">الصفحات المعتمدة</th>
                  <th className="p-3.5 text-center">المناقشات</th>
                  <th className="p-3.5 text-center">متوسط الدرجات</th>
                  <th className="p-3.5 text-center">النقاط</th>
                  <th className="p-3.5">اللقب القرائي</th>
                  <th className="p-3.5">آخر نشاط</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">
                      لا يوجد طلاب في هذه المجموعة
                    </td>
                  </tr>
                ) : (
                  studentRows.map((row) => (
                    <tr key={row.student.id} className="hover:bg-wathba-50/40 transition-colors">
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => onSelectStudent(row.student.id)}
                          className="font-black text-wathba-700 hover:text-wathba-900 hover:underline flex items-center gap-1 text-right"
                        >
                          <span>{row.student.fullName}</span>
                          <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        <span className="text-[10px] text-slate-400 block">
                          {row.student.grade} • {row.student.groupName}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-bold">{row.loansCount}</td>
                      <td className="p-3.5 text-center font-bold text-emerald-700">{row.completedCount}</td>
                      <td className="p-3.5 text-center font-black text-wathba-800">{row.pagesCount}</td>
                      <td className="p-3.5 text-center font-bold text-indigo-700">{row.discussionsCount}</td>
                      <td className="p-3.5 text-center font-bold">{row.avgScore}%</td>
                      <td className="p-3.5 text-center font-black text-amber-700">{row.pointsCount}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-lg bg-wathba-50 text-wathba-800 border border-wathba-200 font-bold text-[11px]">
                          {row.currentRankTitle}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                        {row.lastActivityIso ? formatArabicDate(row.lastActivityIso) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. تحليل أداء المجموعة والرسوم البيانية */}
      {reportSettings.groupSections.performanceAnalysis && (
        <div className="space-y-5">
          {/* Participation Donuts + Period Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DonutMetricCard
              title="نسبة مشاركة الطلاب في القراءة"
              percent={readingParticipationPct}
              centerLabel={`${activeReadersCount} من ${groupStudents.length} طالب`}
              subLabel={`نسبة الطلاب النشطين قرائياً خلال الفترة (${period.label})`}
              color="#3b707d"
            />
            <DonutMetricCard
              title="نسبة مشاركة الطلاب في المناقشات"
              percent={discussionParticipationPct}
              centerLabel={`${studentsWithDiscussionsCount} من ${groupStudents.length} طالب`}
              subLabel="نسبة الطلاب الذين أجروا مناقشة قرائية واحدة على الأقل"
              color="#059669"
            />
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-3">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-wathba-600" />
                <span>مقارنة الأداء مع الفترة السابقة</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl">
                  <span className="text-slate-600">الإعارات:</span>
                  <span className="font-black text-slate-900">
                    {currLoansForCmp} مقابل {prevLoansCount} سابقاً
                  </span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl">
                  <span className="text-slate-600">الصفحات المعتمدة:</span>
                  <span className="font-black text-wathba-800">
                    {currPagesForCmp} مقابل {prevPagesCount} سابقاً
                  </span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl">
                  <span className="text-slate-600">المناقشات المعتمدة:</span>
                  <span className="font-black text-emerald-700">
                    {currDiscForCmp} مقابل {prevDiscCount} سابقاً
                  </span>
                </div>
              </div>
            </div>
          </div>

          {reportSettings.groupSections.charts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <VerticalColumnChart
                title="تطور الصفحات المعتمدة لأبرز طلاب المجموعة"
                subtitle="مقارنة بين أكثر الطلاب قراءة"
                data={topReaders.map((r) => ({
                  label: r.student.fullName.split(' ').slice(0, 2).join(' '),
                  value: r.pagesCount,
                }))}
                unit="صفحة"
                color="#3b707d"
              />
              <HorizontalBarChart
                title="أكثر الطلاب مناقشة وتفاعلاً"
                subtitle="عدد المناقشات المنجزة والنقاط المعتمدة"
                data={topDiscussers.map((r) => ({
                  label: r.student.fullName,
                  value: r.discussionsCount,
                  subLabel: `${r.pointsCount} نقطة`,
                }))}
                unit="مناقشة"
                accentColor="#059669"
              />
              <HorizontalBarChart
                title="أكثر الكتب استعارة"
                data={topBorrowedBooks.map((b) => ({
                  label: b.title,
                  value: b.count,
                }))}
                unit="استعارة"
                accentColor="#026bc9"
              />
              <HorizontalBarChart
                title="أكثر التصنيفات طلباً وأكثر الكتب إتماماً"
                data={[
                  ...topCategories.map((c) => ({
                    label: `تصنيف: ${c.name}`,
                    value: c.count,
                    color: '#3b707d',
                  })),
                  ...topCompletedBooks.slice(0, 3).map((b) => ({
                    label: `إتمام قراءة: ${b.title}`,
                    value: b.count,
                    color: '#d97706',
                  })),
                ]}
                unit="مرة"
              />
            </div>
          )}

          {/* Highlights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-2.5">
              <h4 className="font-black text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-gold-600" />
                <span>الطلاب الأكثر تقدماً في الألقاب</span>
              </h4>
              {topRankProgress.slice(0, 4).map((r) => (
                <div key={r.student.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl">
                  <button
                    type="button"
                    onClick={() => onSelectStudent(r.student.id)}
                    className="font-bold text-wathba-800 hover:underline"
                  >
                    {r.student.fullName}
                  </button>
                  <span className="font-bold text-slate-700">
                    {r.currentRankTitle} ({r.pagesCount} صفحة)
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl border border-rose-200 p-5 shadow-soft space-y-2.5">
              <h4 className="font-black text-rose-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>طلاب يحتاجون إلى تشجيع ومتابعة ({needsEncouragement.length})</span>
              </h4>
              {needsEncouragement.length === 0 ? (
                <p className="text-emerald-700 font-bold bg-emerald-50 p-3 rounded-xl">
                  جميع طلاب المجموعة متفاعلون في القراءة والمناقشات! 🌟
                </p>
              ) : (
                needsEncouragement.slice(0, 5).map((r) => (
                  <div key={r.student.id} className="flex items-center justify-between bg-rose-50/70 px-3 py-2 rounded-xl">
                    <button
                      type="button"
                      onClick={() => onSelectStudent(r.student.id)}
                      className="font-bold text-slate-900 hover:underline"
                    >
                      {r.student.fullName}
                    </button>
                    <span className="text-[11px] font-bold text-rose-700">
                      {r.pagesCount === 0 ? 'لم يسجل صفحات بعد' : 'لم يُجرِ مناقشة بعد'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. ملخص المشرف التفاعلي */}
      {reportSettings.groupSections.supervisorSummary && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-sm text-slate-900">ملخص المشرف وتوصيات المجموعة</h3>
              <p className="text-[11px] text-slate-500">
                يُحفظ هذا الملخص في قاعدة البيانات ويظهر تلقائياً عند طباعة التقرير أو تصديره PDF / Excel
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSaveSupervisorSummary}
            >
              حفظ ملخص المشرف
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">أبرز الإنجازات:</label>
              <textarea
                rows={2}
                value={keyAchievements}
                onChange={(e) => setKeyAchievements(e.target.value)}
                placeholder="أبرز إنجازات المجموعة خلال الفترة..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">الملاحظات العامة:</label>
              <textarea
                rows={2}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="الانطباع العام ومستوى التفاعل..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">الصعوبات:</label>
              <textarea
                rows={2}
                value={difficulties}
                onChange={(e) => setDifficulties(e.target.value)}
                placeholder="أي تحديات أو تأخر في الإرجاع أو المناقشة..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">الطلاب الذين يحتاجون إلى متابعة:</label>
              <textarea
                rows={2}
                value={studentsNeedingFollowUp}
                onChange={(e) => setStudentsNeedingFollowUp(e.target.value)}
                placeholder="أسماء الطلاب وأسباب المتابعة المطلوبة..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="font-bold text-slate-700 block">التوصيات للفترة القادمة:</label>
              <textarea
                rows={2}
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="خطط التحفيز والكتب المقترحة للفترة القادمة..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
