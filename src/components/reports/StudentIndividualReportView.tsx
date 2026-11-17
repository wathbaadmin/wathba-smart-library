import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { ReportPeriodPreset } from '../../types';
import { formatArabicDate, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { resolveReportPeriod, isTimestampInRange } from '../../lib/reportPeriodUtils';
import {
  getDiscussionStatusMeta,
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
  User,
  BookOpen,
  Award,
  Download,
  Printer,
  FileSpreadsheet,
  Save,
  CheckCircle2,
  MessageSquareText,
} from 'lucide-react';

interface StudentIndividualReportViewProps {
  selectedStudentId: string;
  onChangeStudent: (studentId: string) => void;
}

export const StudentIndividualReportView: React.FC<StudentIndividualReportViewProps> = ({
  selectedStudentId,
  onChangeStudent,
}) => {
  const { currentStaff } = useAuth();
  const {
    students,
    staff,
    books,
    copies,
    loans,
    readingLogs,
    discussions,
    reportSettings,
    studentReportNotes,
    saveStudentReportNote,
    getStudentRankSummary,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const scopedStudents = filterStudentsForStaffScope(students, liveStaff);

  const activeStudent =
    scopedStudents.find((s) => s.id === selectedStudentId) || scopedStudents[0] || null;

  const [periodPreset, setPeriodPreset] = useState<ReportPeriodPreset>(reportSettings.defaultPeriod || 'all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const period = resolveReportPeriod(periodPreset, customFrom, customTo);

  // Supervisor notes for student
  const existingNote = activeStudent
    ? studentReportNotes.find((n) => n.studentId === activeStudent.id)
    : undefined;
  const [interestLevel, setInterestLevel] = useState('مرتفع');
  const [comprehensionLevel, setComprehensionLevel] = useState('جيد جداً');
  const [keyBenefits, setKeyBenefits] = useState('');
  const [suggestedBooks, setSuggestedBooks] = useState('');
  const [recommendations, setRecommendations] = useState('');

  useEffect(() => {
    setInterestLevel(existingNote?.interestLevel || 'مرتفع');
    setComprehensionLevel(existingNote?.comprehensionLevel || 'جيد جداً');
    setKeyBenefits(existingNote?.keyBenefits || '');
    setSuggestedBooks(existingNote?.suggestedBooks || '');
    setRecommendations(existingNote?.recommendations || '');
  }, [activeStudent?.id, existingNote?.updatedAt]);

  if (!activeStudent) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-xs text-slate-400">
        لا يوجد طلاب متاحون ضمن نطاق الصلاحيات المحددة
      </div>
    );
  }

  const assignedSupervisor =
    staff.find(
      (st) =>
        st.role === 'supervisor' &&
        st.assignedGroups &&
        st.assignedGroups.includes(activeStudent.groupName)
    ) ||
    staff.find((st) => st.role === 'supervisor') ||
    liveStaff ||
    staff[0];

  const rankSummary = getStudentRankSummary(activeStudent.id);

  // Period filtered records
  const sLoansPeriod = loans
    .filter(
      (l) =>
        l.studentId === activeStudent.id &&
        l.status !== 'cancelled' &&
        isTimestampInRange(l.loanDate, period.startMs, period.endMs)
    )
    .sort((a, b) => new Date(b.loanDate).getTime() - new Date(a.loanDate).getTime());

  const sReturnedPeriod = sLoansPeriod.filter((l) => l.status === 'returned');

  const sLogsPeriod = readingLogs
    .filter(
      (l) =>
        l.studentId === activeStudent.id &&
        isTimestampInRange(l.readingDate || l.createdAt, period.startMs, period.endMs)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const sApprovedLogsPeriod = sLogsPeriod.filter((l) => l.status === 'approved');
  const approvedPagesPeriod = sApprovedLogsPeriod.reduce(
    (sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount),
    0
  );

  // Completed books count in period
  const pagesByBookPeriod = new Map<string, number>();
  sApprovedLogsPeriod.forEach((l) => {
    pagesByBookPeriod.set(
      l.bookId,
      (pagesByBookPeriod.get(l.bookId) || 0) + (l.correctedPagesCount ?? l.pagesCount)
    );
  });
  let completedBooksPeriodCount = 0;
  pagesByBookPeriod.forEach((pSum, bId) => {
    const bk = books.find((b) => b.id === bId);
    const target = bk?.pageCount && bk.pageCount > 0 ? bk.pageCount : 100;
    if (pSum >= target) completedBooksPeriodCount += 1;
  });

  const sDiscussionsPeriod = discussions
    .filter(
      (d) =>
        d.studentId === activeStudent.id &&
        isTimestampInRange(d.discussionDate || d.requestDate, period.startMs, period.endMs)
    )
    .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

  const sDiscDone = sDiscussionsPeriod.filter((d) => isDiscussionCompletedOrApproved(d));
  const sDiscApproved = sDiscussionsPeriod.filter((d) => d.status === 'approved');
  const avgDiscussionScore =
    sDiscDone.length > 0
      ? Math.round(sDiscDone.reduce((sum, d) => sum + d.totalScore, 0) / sDiscDone.length)
      : 0;
  const totalPointsPeriod = sDiscApproved.reduce(
    (sum, d) => sum + (Number(d.pointsAwarded) || 0),
    0
  );
  const earnedRanks = rankSummary.tiers.filter((t) => t.status === 'earned');

  // Book Log enriched rows
  const bookLogRows = sLoansPeriod.map((loan) => {
    const copy = copies.find((c) => c.id === loan.copyId);
    const book = books.find((b) => b.id === copy?.bookId);
    const approvedPagesForBook = readingLogs
      .filter((r) => r.studentId === activeStudent.id && r.bookId === book?.id && r.status === 'approved')
      .reduce((sum, r) => sum + (r.correctedPagesCount ?? r.pagesCount), 0);
    const targetPages = book?.pageCount && book.pageCount > 0 ? book.pageCount : 100;
    const isReadingComplete = approvedPagesForBook >= targetPages || loan.status === 'returned';
    const discForBook = book
      ? discussions.find(
          (d) =>
            d.studentId === activeStudent.id &&
            d.bookId === book.id &&
            isDiscussionCompletedOrApproved(d)
        )
      : undefined;

    const loanStatusLabel =
      loan.status === 'returned'
        ? 'معاد للمكتبة'
        : loan.status === 'overdue' || new Date().getTime() > new Date(loan.dueDate).getTime()
        ? 'متأخر'
        : 'مستعار حالياً';

    return {
      loan,
      book,
      loanStatusLabel,
      isReadingComplete: approvedPagesForBook >= targetPages,
      hasDiscussion: !!discForBook,
      discussionScore: discForBook ? `${discForBook.totalScore}/${discForBook.maxScore || 100}` : '—',
      readingNoteHint: isReadingComplete ? 'نعم' : 'لا',
    };
  });

  // Charts Data: Monthly/Log progression
  const pagesTimelineData = [...sApprovedLogsPeriod]
    .reverse()
    .slice(-8)
    .map((l) => {
      const bk = books.find((b) => b.id === l.bookId);
      return {
        label: bk ? bk.title.split(' ').slice(0, 2).join(' ') : formatArabicDate(l.readingDate),
        value: l.correctedPagesCount ?? l.pagesCount,
      };
    });

  const discussionScoresData = [...sDiscDone]
    .reverse()
    .slice(-6)
    .map((d) => {
      const bk = books.find((b) => b.id === d.bookId);
      return {
        label: bk ? bk.title.split(' ').slice(0, 2).join(' ') : 'مناقشة',
        value: d.totalScore,
        subLabel: `${d.pointsAwarded} نقطة`,
      };
    });

  const handleSaveStudentNotes = () => {
    if (!liveStaff) return;
    saveStudentReportNote({
      studentId: activeStudent.id,
      supervisorId: liveStaff.id,
      supervisorName: liveStaff.fullName,
      interestLevel,
      comprehensionLevel,
      keyBenefits,
      suggestedBooks,
      recommendations,
    });
    showToast('تم حفظ ملاحظات وتوصيات الطالب بنجاح ✅', 'success');
  };

  const buildOfficialPayload = (): OfficialReportPayload => ({
    reportTitle: `التقرير الفردي الشامل للطالب: ${activeStudent.fullName}`,
    subtitle: `${activeStudent.grade} • ${activeStudent.groupName} — سجل الإنجاز القرائي والمناقشات`,
    periodLabel: period.label,
    supervisorName: assignedSupervisor?.fullName || liveStaff?.fullName,
    metadata: [
      { label: 'اسم الطالب', value: activeStudent.fullName },
      { label: 'المجموعة', value: activeStudent.groupName },
      { label: 'المشرف المسؤول', value: assignedSupervisor?.fullName || 'غير محدد' },
      { label: 'اللقب القرائي الحالي', value: rankSummary.currentRank?.title || 'بدون لقب بعد' },
      { label: 'الألقاب الحاصل عليها', value: `${earnedRanks.length} ألقاب` },
      { label: 'الشهادات الصادرة', value: `${rankSummary.certificates.length} شهادات` },
    ],
    kpis: [
      { label: 'الكتب المستعارة', value: sLoansPeriod.length },
      { label: 'الكتب التي أتم قراءتها', value: completedBooksPeriodCount },
      { label: 'الكتب المعادة', value: sReturnedPeriod.length },
      { label: 'الصفحات المعتمدة', value: approvedPagesPeriod },
      { label: 'عدد المناقشات', value: sDiscDone.length },
      { label: 'متوسط درجات المناقشة', value: `${avgDiscussionScore}%` },
      { label: 'إجمالي النقاط', value: totalPointsPeriod },
      { label: 'التقدم للقب القادم', value: `${rankSummary.progressPercentToNext}%` },
    ],
    charts: reportSettings.studentSections.progressCharts
      ? [
          {
            title: 'تطور الصفحات المعتمدة',
            bars: pagesTimelineData.map((d) => ({ label: d.label, value: d.value, unit: 'صفحة' })),
          },
          {
            title: 'تطور درجات المناقشات',
            bars: discussionScoresData.map((d) => ({ label: d.label, value: d.value, unit: 'درجة' })),
          },
        ]
      : [],
    tables: [
      ...(reportSettings.studentSections.booksLog
        ? [
            {
              title: 'سجل الكتب المستعارة',
              columns: ['الكتاب', 'المؤلف', 'الاستعارة', 'الإرجاع', 'الصفحات', 'الحالة', 'أتم القراءة', 'المناقشة', 'الدرجة'],
              rows: bookLogRows.map((r) => [
                r.book?.title || '-',
                r.book?.author || '-',
                formatArabicDate(r.loan.loanDate),
                r.loan.returnDate ? formatArabicDate(r.loan.returnDate) : '—',
                r.book?.pageCount || '-',
                r.loanStatusLabel,
                r.isReadingComplete ? 'نعم' : 'قيد القراءة',
                r.hasDiscussion ? 'نعم' : 'لا',
                r.discussionScore,
              ]),
            },
          ]
        : []),
      ...(reportSettings.studentSections.readingLog
        ? [
            {
              title: 'سجل القراءة واعتماد الصفحات',
              columns: ['الكتاب', 'الصفحات', 'تاريخ التسجيل', 'تاريخ الاعتماد', 'المشرف', 'الحالة'],
              rows: sLogsPeriod.map((l) => {
                const bk = books.find((b) => b.id === l.bookId);
                const revStaff = staff.find((st) => st.id === l.reviewedByStaffId);
                return [
                  bk?.title || '-',
                  l.correctedPagesCount ?? l.pagesCount,
                  formatArabicDate(l.createdAt),
                  l.reviewedAt ? formatArabicDate(l.reviewedAt) : '—',
                  revStaff?.fullName || '—',
                  l.status === 'approved' ? 'معتمد' : l.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة',
                ];
              }),
            },
          ]
        : []),
      ...(reportSettings.studentSections.discussionsLog
        ? [
            {
              title: 'سجل المناقشات القرائية',
              columns: ['الكتاب', 'تاريخ المناقشة', 'المشرف', 'الدرجة النهائية', 'النقاط', 'النتيجة / الحالة'],
              rows: sDiscussionsPeriod.map((d) => {
                const bk = books.find((b) => b.id === d.bookId);
                const sup = staff.find((st) => st.id === d.supervisorId);
                return [
                  bk?.title || '-',
                  d.discussionDate ? formatArabicDate(d.discussionDate) : formatArabicDate(d.requestDate),
                  sup?.fullName || '—',
                  d.evaluation.length > 0 ? `${d.totalScore}/${d.maxScore || 100}` : '—',
                  d.status === 'approved' ? d.pointsAwarded : 0,
                  getDiscussionStatusMeta(d.status).label,
                ];
              }),
            },
          ]
        : []),
    ],
    notesBlocks: reportSettings.studentSections.supervisorNotes
      ? [
          {
            title: 'ملاحظات وتوصيات المشرف للطالب',
            items: [
              { label: 'مستوى اهتمام الطالب بالقراءة', value: interestLevel },
              { label: 'مدى فهمه واستيعابه للكتب', value: comprehensionLevel },
              { label: 'أبرز الفوائد والمكتسبات', value: keyBenefits },
              { label: 'الكتب المقترحة له', value: suggestedBooks },
              { label: 'التوصيات التربوية', value: recommendations },
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
        `تقرير_الطالب_${activeStudent.fullName}`
      );
      showToast('تم تصدير التقرير الفردي للطالب بصيغة PDF بنجاح 📄', 'success');
    } catch (err: any) {
      showToast(err?.message || 'تعذر إنشاء ملف PDF', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    exportStructuredExcelReport(`تقرير_الطالب_${activeStudent.fullName}`, [
      {
        sheetName: 'ملخص الطالب',
        rows: [
          { البيان: 'اسم الطالب', القيمة: activeStudent.fullName },
          { البيان: 'المجموعة', القيمة: activeStudent.groupName },
          { البيان: 'المشرف المسؤول', القيمة: assignedSupervisor?.fullName || '-' },
          { البيان: 'الفترة الزمنية', القيمة: period.label },
          { البيان: 'اللقب القرائي الحالي', القيمة: rankSummary.currentRank?.title || 'بدون لقب بعد' },
          { البيان: 'إجمالي الكتب المستعارة', القيمة: sLoansPeriod.length },
          { البيان: 'الكتب التي أتم قراءتها', القيمة: completedBooksPeriodCount },
          { البيان: 'الكتب المعادة', القيمة: sReturnedPeriod.length },
          { البيان: 'الصفحات المعتمدة', القيمة: approvedPagesPeriod },
          { البيان: 'عدد المناقشات', القيمة: sDiscDone.length },
          { البيان: 'متوسط درجات المناقشات', القيمة: `${avgDiscussionScore}%` },
          { البيان: 'إجمالي النقاط', القيمة: totalPointsPeriod },
          { البيان: 'الشهادات الصادرة', القيمة: rankSummary.certificates.length },
        ],
      },
      {
        sheetName: 'سجل الكتب',
        rows: bookLogRows.map((r) => ({
          'عنوان الكتاب': r.book?.title || '-',
          'المؤلف': r.book?.author || '-',
          'تاريخ الاستعارة': formatArabicDate(r.loan.loanDate),
          'تاريخ الإرجاع': r.loan.returnDate ? formatArabicDate(r.loan.returnDate) : '—',
          'عدد الصفحات': r.book?.pageCount || '-',
          'الحالة': r.loanStatusLabel,
          'أكمل القراءة؟': r.isReadingComplete ? 'نعم' : 'لا',
          'تمت المناقشة؟': r.hasDiscussion ? 'نعم' : 'لا',
          'درجة المناقشة': r.discussionScore,
        })),
      },
      {
        sheetName: 'سجل القراءة',
        rows: sLogsPeriod.map((l) => {
          const bk = books.find((b) => b.id === l.bookId);
          const rev = staff.find((st) => st.id === l.reviewedByStaffId);
          return {
            'الكتاب': bk?.title || '-',
            'الصفحات': l.correctedPagesCount ?? l.pagesCount,
            'تاريخ التسجيل': formatArabicDate(l.createdAt),
            'تاريخ الاعتماد': l.reviewedAt ? formatArabicDate(l.reviewedAt) : '—',
            'المشرف': rev?.fullName || '—',
            'الحالة': l.status,
          };
        }),
      },
      {
        sheetName: 'سجل المناقشات',
        rows: sDiscussionsPeriod.map((d) => {
          const bk = books.find((b) => b.id === d.bookId);
          const sup = staff.find((st) => st.id === d.supervisorId);
          return {
            'الكتاب': bk?.title || '-',
            'التاريخ': formatArabicDate(d.discussionDate || d.requestDate),
            'المشرف': sup?.fullName || '—',
            'تفاصيل التقييم': d.evaluation.map((e) => `${e.name}: ${e.awardedPoints}/${e.maxPoints}`).join(' | '),
            'الدرجة النهائية': d.totalScore,
            'النقاط المكتسبة': d.status === 'approved' ? d.pointsAwarded : 0,
            'ملاحظات المشرف': d.supervisorNotes || '—',
            'النتيجة': getDiscussionStatusMeta(d.status).label,
          };
        }),
      },
    ]);
    showToast('تم تصدير التقرير الفردي للطالب بصيغة Excel بنجاح 📊', 'success');
  };

  return (
    <div className="space-y-6">
      {/* 1. Student & Period Controls */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">اختر الطالب:</label>
            <select
              value={activeStudent.id}
              onChange={(e) => onChangeStudent(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 font-bold bg-slate-50 min-w-[220px]"
            >
              {scopedStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.grade} - {s.groupName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 block mb-1">الفترة الزمنية:</label>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as ReportPeriodPreset)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 font-bold bg-slate-50"
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
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs mt-4"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs mt-4"
              />
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

      {/* 2. بيانات الطالب */}
      {reportSettings.studentSections.studentInfo && (
        <div className="bg-gradient-to-l from-[#162b31] via-[#3b707d] to-[#325d68] text-white rounded-3xl p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-gold-300" />
            </div>
            <div>
              <h3 className="text-2xl font-black">{activeStudent.fullName}</h3>
              <p className="text-xs text-wathba-100 mt-1">
                المجموعة: <strong className="text-white">{activeStudent.groupName}</strong> • الصف:{' '}
                <strong className="text-white">{activeStudent.grade}</strong> • المشرف المسؤول:{' '}
                <strong className="text-white">{assignedSupervisor?.fullName || 'غير محدد'}</strong>
              </p>
              <span className="inline-block mt-2 text-[11px] px-3 py-0.5 rounded-full bg-white/15 border border-white/20 text-gold-200 font-bold">
                الفترة: {period.label}
              </span>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-center shrink-0">
            <span className="text-[10px] text-wathba-100 block">اللقب القرائي الحالي</span>
            <strong className="text-base font-black text-gold-300">
              {rankSummary.currentRank?.title || 'لم يحصل على لقب بعد'}
            </strong>
          </div>
        </div>
      )}

      {/* 3. ملخص الإنجازات */}
      {reportSettings.studentSections.achievementSummary && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'إجمالي الكتب المستعارة', value: sLoansPeriod.length },
              { label: 'الكتب التي أتم قراءتها', value: completedBooksPeriodCount },
              { label: 'الكتب المعادة', value: sReturnedPeriod.length },
              { label: 'الصفحات المعتمدة', value: approvedPagesPeriod },
              { label: 'عدد المناقشات', value: sDiscDone.length },
              { label: 'متوسط درجات المناقشة', value: `${avgDiscussionScore}%` },
              { label: 'إجمالي النقاط', value: totalPointsPeriod },
              { label: 'الألقاب الحاصل عليها', value: earnedRanks.length },
              { label: 'الشهادات الصادرة', value: rankSummary.certificates.length },
            ].map((item, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
                <span className="text-[11px] font-bold text-slate-500 block">{item.label}</span>
                <strong className="text-xl font-black text-wathba-800 mt-1 block">{item.value}</strong>
              </div>
            ))}
          </div>

          {earnedRanks.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center gap-2 text-xs">
              <span className="font-black text-slate-700">الألقاب المكتسبة:</span>
              {earnedRanks.map((t) => (
                <span key={t.rank.id} className="px-3 py-1 rounded-full bg-wathba-50 text-wathba-800 border border-wathba-200 font-bold">
                  {t.rank.title}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. سجل الكتب */}
      {reportSettings.studentSections.booksLog && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-sm text-slate-900">
            سجل الكتب المستعارة ({bookLogRows.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3.5">عنوان الكتاب</th>
                  <th className="p-3.5">المؤلف</th>
                  <th className="p-3.5">تاريخ الاستعارة</th>
                  <th className="p-3.5">تاريخ الإرجاع</th>
                  <th className="p-3.5 text-center">عدد الصفحات</th>
                  <th className="p-3.5">حالة الكتاب</th>
                  <th className="p-3.5 text-center">أكمل القراءة؟</th>
                  <th className="p-3.5 text-center">تمت مناقشته؟</th>
                  <th className="p-3.5 text-center">درجة المناقشة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookLogRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      لا توجد استعارات مسجلة خلال الفترة
                    </td>
                  </tr>
                ) : (
                  bookLogRows.map((r) => (
                    <tr key={r.loan.id} className="hover:bg-slate-50">
                      <td className="p-3.5 font-bold text-slate-900">{r.book?.title || '-'}</td>
                      <td className="p-3.5 text-slate-600">{r.book?.author || '-'}</td>
                      <td className="p-3.5 text-slate-600">{formatArabicDate(r.loan.loanDate)}</td>
                      <td className="p-3.5 text-slate-600">
                        {r.loan.returnDate ? formatArabicDate(r.loan.returnDate) : '—'}
                      </td>
                      <td className="p-3.5 text-center font-mono">{r.book?.pageCount || '-'}</td>
                      <td className="p-3.5 font-bold text-wathba-800">{r.loanStatusLabel}</td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.isReadingComplete
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.isReadingComplete ? 'نعم' : 'لا'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.hasDiscussion
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.hasDiscussion ? 'نعم' : 'لا'}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-black text-wathba-800">{r.discussionScore}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. سجل القراءة */}
      {reportSettings.studentSections.readingLog && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-sm text-slate-900">
            سجل القراءة واعتماد الصفحات ({sLogsPeriod.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3.5">اسم الكتاب</th>
                  <th className="p-3.5 text-center">عدد الصفحات (النطاق)</th>
                  <th className="p-3.5">تاريخ التسجيل</th>
                  <th className="p-3.5">تاريخ الاعتماد</th>
                  <th className="p-3.5">اسم المشرف</th>
                  <th className="p-3.5">حالة الطلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sLogsPeriod.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      لا توجد سجلات قراءة مسجلة خلال الفترة
                    </td>
                  </tr>
                ) : (
                  sLogsPeriod.map((l) => {
                    const bk = books.find((b) => b.id === l.bookId);
                    const rev = staff.find((st) => st.id === l.reviewedByStaffId);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-bold text-slate-900">{bk?.title || '-'}</td>
                        <td className="p-3.5 text-center font-bold text-wathba-800">
                          {l.correctedPagesCount ?? l.pagesCount} صفحة ({l.fromPage}-{l.toPage})
                        </td>
                        <td className="p-3.5 text-slate-600">{formatArabicDate(l.createdAt)}</td>
                        <td className="p-3.5 text-slate-600">
                          {l.reviewedAt ? formatArabicDate(l.reviewedAt) : '—'}
                        </td>
                        <td className="p-3.5 text-slate-700">{rev?.fullName || '—'}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              l.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : l.status === 'rejected'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : l.status === 'superseded'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {l.status === 'approved'
                              ? 'معتمد'
                              : l.status === 'rejected'
                              ? 'مرفوض'
                              : l.status === 'superseded'
                              ? 'مُصحّح'
                              : 'بانتظار الاعتماد'}
                          </span>
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

      {/* 6. سجل المناقشات */}
      {reportSettings.studentSections.discussionsLog && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-black text-sm text-slate-900">
            سجل المناقشات القرائية ({sDiscussionsPeriod.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3.5">اسم الكتاب</th>
                  <th className="p-3.5">تاريخ المناقشة</th>
                  <th className="p-3.5">المشرف</th>
                  <th className="p-3.5">درجات عناصر التقييم</th>
                  <th className="p-3.5 text-center">الدرجة النهائية</th>
                  <th className="p-3.5 text-center">النقاط المكتسبة</th>
                  <th className="p-3.5">ملاحظات المشرف</th>
                  <th className="p-3.5">النتيجة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sDiscussionsPeriod.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      لا توجد مناقشات مسجلة للطالب خلال هذه الفترة
                    </td>
                  </tr>
                ) : (
                  sDiscussionsPeriod.map((d) => {
                    const bk = books.find((b) => b.id === d.bookId);
                    const sup = staff.find((st) => st.id === d.supervisorId);
                    const statusMeta = getDiscussionStatusMeta(d.status);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-3.5 font-bold text-slate-900">{bk?.title || '-'}</td>
                        <td className="p-3.5 text-slate-600">
                          {formatArabicDate(d.discussionDate || d.requestDate)}
                        </td>
                        <td className="p-3.5 text-slate-700">{sup?.fullName || '—'}</td>
                        <td className="p-3.5 max-w-[220px]">
                          {d.evaluation.length > 0 ? (
                            <div className="space-y-0.5 text-[10px] text-slate-600">
                              {d.evaluation.map((ev, idx) => (
                                <div key={idx}>
                                  {ev.name}: <strong className="text-slate-900">{ev.awardedPoints}/{ev.maxPoints}</strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-3.5 text-center font-black text-wathba-800">
                          {d.evaluation.length > 0 ? `${d.totalScore}/${d.maxScore || 100}` : '—'}
                        </td>
                        <td className="p-3.5 text-center font-black text-emerald-700">
                          {d.status === 'approved' ? `+${d.pointsAwarded}` : '0'}
                        </td>
                        <td className="p-3.5 text-slate-600 max-w-[180px] truncate" title={d.supervisorNotes}>
                          {d.supervisorNotes || '—'}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
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

      {/* 7. تحليل تقدم الطالب (رسوم بيانية) */}
      {reportSettings.studentSections.progressCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DonutMetricCard
            title="التقدم نحو اللقب القرائي القادم"
            percent={rankSummary.progressPercentToNext}
            centerLabel={rankSummary.nextRank ? rankSummary.nextRank.title : 'القمة: وثّاب'}
            subLabel={
              rankSummary.nextRank
                ? `متبقي ${rankSummary.remainingPagesToNext} صفحة للوصول إلى ${rankSummary.nextRank.title}`
                : 'تم إنجاز أعلى مرتبة قرائية في المكتبة'
            }
            color="#3b707d"
          />
          <VerticalColumnChart
            title="تطور عدد الصفحات المقروءة"
            data={pagesTimelineData}
            unit="صفحة"
            color="#3b707d"
          />
          <HorizontalBarChart
            title="درجات المناقشات والنقاط المكتسبة"
            data={discussionScoresData}
            unit="درجة"
            accentColor="#059669"
          />
        </div>
      )}

      {/* 8. ملاحظات وتوصيات المشرف */}
      {reportSettings.studentSections.supervisorNotes && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-sm text-slate-900">ملاحظات وتوصيات المشرف للطالب</h3>
              <p className="text-[11px] text-slate-500">
                تقييم مستوى اهتمام الطالب، مدى فهمه، الكتب المقترحة، والتوصيات المعتمدة بالتقرير
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              onClick={handleSaveStudentNotes}
            >
              حفظ توصيات الطالب
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">مستوى اهتمام الطالب بالقراءة:</label>
              <select
                value={interestLevel}
                onChange={(e) => setInterestLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
              >
                <option value="مرتفع جداً">مرتفع جداً</option>
                <option value="مرتفع">مرتفع</option>
                <option value="متوسط">متوسط</option>
                <option value="يحتاج تحفيز">يحتاج تحفيز وتشجيع</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">مدى فهمه للكتب:</label>
              <select
                value={comprehensionLevel}
                onChange={(e) => setComprehensionLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
              >
                <option value="ممتاز وعميق">ممتاز وعميق</option>
                <option value="جيد جداً">جيد جداً</option>
                <option value="جيد">جيد</option>
                <option value="يحتاج متابعة وتلخيص">يحتاج متابعة في الفهم والتلخيص</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">أبرز فوائده ومهاراته:</label>
              <textarea
                rows={2}
                value={keyBenefits}
                onChange={(e) => setKeyBenefits(e.target.value)}
                placeholder="أبرز الفوائد التي ظهرت في مناقشاته وتلخيصاته..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">الكتب المقترحة له:</label>
              <textarea
                rows={2}
                value={suggestedBooks}
                onChange={(e) => setSuggestedBooks(e.target.value)}
                placeholder="عناوين كتب مناسبة لمستواه واهتماماته..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="font-bold text-slate-700 block">التوصيات:</label>
              <textarea
                rows={2}
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="توصيات المشرف للوالدين والطالب لتعزيز تقدمه القرائي..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
