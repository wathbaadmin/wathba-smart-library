import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  ReadingCertificate,
  ReadingLog,
  ReadingRankDefinition,
  ReadingRankThemeKey,
} from '../../types';
import { RANK_THEME_PRESETS } from '../../lib/ranksData';
import { formatUmmAlQuraDate, formatArabicDate } from '../../lib/dateUtils';
import { printDirectReport } from '../../lib/exportUtils';
import { filterStudentsForStaffScope } from '../../lib/discussionUtils';
import { RankEmblem } from '../student/ranks/RankEmblem';
import { CertificateViewerModal } from '../student/ranks/CertificateViewerModal';
import { SupervisorLogReadingModal } from './SupervisorLogReadingModal';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  Award,
  Crown,
  Trophy,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  ScrollText,
  Sliders,
  Users,
  BarChart3,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Download,
  Printer,
  History,
  FileCheck,
  Search,
  RefreshCw,
  Eye,
  Power,
  TrendingUp,
} from 'lucide-react';

type AdminRanksTab = 'stats_approvals' | 'ranks_config' | 'cert_templates' | 'students_certs';

export interface RanksAndCertificatesManagerProps {
  initialSubTab?: 'stats_approvals' | 'ranks_config' | 'cert_templates' | 'students_certs';
}

export const RanksAndCertificatesManager: React.FC<RanksAndCertificatesManagerProps> = ({
  initialSubTab = 'stats_approvals',
}) => {
  const { currentStaff } = useAuth();
  const {
    readingRanks,
    certificateSettings,
    readingLogs,
    readingLogCorrections,
    readingCertificates,
    students,
    staff,
    books,
    getStudentRankSummary,
    approveReadingLog,
    rejectReadingLog,
    correctReadingLog,
    reissueCertificate,
    addReadingRank,
    updateReadingRank,
    deleteReadingRank,
    reorderReadingRanks,
    updateCertificateSettings,
  } = useLibrary();
  const { showToast } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';
  const [subTab, setSubTab] = useState<AdminRanksTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const [supLogModalOpen, setSupLogModalOpen] = useState(false);
  const [supLogInitialStudentId, setSupLogInitialStudentId] = useState<string | undefined>(undefined);

  // Reading Logs Filter & Modals
  const [logStatusFilter, setLogStatusFilter] = useState<
    'pending' | 'approved' | 'rejected' | 'superseded' | 'all'
  >(() => ((readingLogs || []).some((l) => l.status === 'pending') ? 'pending' : 'approved'));
  const [rejectModalLog, setRejectModalLog] = useState<ReadingLog | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [correctModalLog, setCorrectModalLog] = useState<ReadingLog | null>(null);
  const [corrFromPage, setCorrFromPage] = useState(1);
  const [corrToPage, setCorrToPage] = useState(1);
  const [corrReason, setCorrReason] = useState('');

  // Students & Certificates Filter + Reissue Modal + Viewer
  const [studentSearch, setStudentSearch] = useState('');
  const [rankFilterId, setRankFilterId] = useState<string>('all');
  const [viewerCert, setViewerCert] = useState<ReadingCertificate | null>(null);
  const [reissueModalTarget, setReissueModalTarget] = useState<{
    studentId: string;
    studentName: string;
    rankId: string;
    rankTitle: string;
  } | null>(null);
  const [reissueReason, setReissueReason] = useState('');

  // Add/Edit Rank Modal
  const [rankModalOpen, setRankModalOpen] = useState(false);
  const [editingRank, setEditingRank] = useState<ReadingRankDefinition | null>(null);
  const [rankForm, setRankForm] = useState<
    Omit<ReadingRankDefinition, 'id' | 'createdAt' | 'updatedAt'>
  >({
    code: 'CUSTOM',
    orderIndex: readingRanks.length + 1,
    title: '',
    subtitle: '',
    requiredPages: 200,
    description: '',
    motivationalPhrase: '',
    themeKey: 'custom',
    primaryColor: '#3b707d',
    secondaryColor: '#e3ecf3',
    accentColor: '#d4af37',
    badgeTitle: '',
    certificateHeading: 'شهادة إنجاز قرائي',
    isHighestTier: false,
    isActive: true,
  });

  // ------------------------------------------------------------------------
  // حساب إحصائيات الإدارة الشاملة (Section 8)
  // ------------------------------------------------------------------------
  const sortedAllRanks = [...(readingRanks || [])].sort(
    (a, b) => a.orderIndex - b.orderIndex || a.requiredPages - b.requiredPages
  );
  const activeSortedRanks = sortedAllRanks.filter((r) => r.isActive);
  const wathabRank =
    activeSortedRanks.find((r) => r.isHighestTier) ||
    activeSortedRanks[activeSortedRanks.length - 1];

  const scopedStudents = filterStudentsForStaffScope(students || [], liveStaff);
  const scopedStudentIdSet = new Set(scopedStudents.map((s) => s.id));

  const studentSummaries = scopedStudents.map((s) => ({
    student: s,
    summary: getStudentRankSummary(s.id),
  }));

  const scopedReadingLogs = (readingLogs || []).filter((l) =>
    scopedStudentIdSet.has(l.studentId)
  );
  const scopedReadingCertificates = (readingCertificates || []).filter((c) =>
    scopedStudentIdSet.has(c.studentId)
  );

  const totalApprovedPagesSystem = scopedReadingLogs
    .filter((l) => l.status === 'approved')
    .reduce((sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount), 0);

  const totalIssuedCerts = scopedReadingCertificates.length;

  const noFirstRankCount = studentSummaries.filter(
    (item) => !item.summary.currentRank
  ).length;

  const topReader = [...studentSummaries].sort(
    (a, b) => b.summary.totalApprovedPages - a.summary.totalApprovedPages
  )[0];

  // الطلاب القريبون من لقب وثّاب (أتموا 70% فأكثر من متطلب وثّاب ولم يبلغوه بعد)
  const nearWathabStudents = wathabRank
    ? studentSummaries.filter(
        ({ summary }) =>
          summary.totalApprovedPages < wathabRank.requiredPages &&
          summary.totalApprovedPages >= Math.floor(wathabRank.requiredPages * 0.65)
      )
    : [];

  // توزيع الطلاب لكل لقب (الحاصلين عليه أو الذين وصلوه كأعلى رتبة)
  const rankCounts = activeSortedRanks.map((rank) => {
    const achievedCount = studentSummaries.filter(({ summary }) =>
      summary.tiers.some((t) => t.rank.id === rank.id && t.status === 'earned')
    ).length;
    return { rank, achievedCount };
  });

  const pendingLogs = scopedReadingLogs.filter((l) => l.status === 'pending');
  const filteredLogs = scopedReadingLogs.filter((l) =>
    logStatusFilter === 'all' ? true : l.status === logStatusFilter
  );

  // تصفية جدول الطلاب في الإدارة
  const filteredStudentSummaries = studentSummaries.filter(({ student, summary }) => {
    const term = studentSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      student.fullName.toLowerCase().includes(term) ||
      student.internalId.toLowerCase().includes(term) ||
      student.grade.toLowerCase().includes(term);

    if (!matchesSearch) return false;
    if (rankFilterId === 'all') return true;
    if (rankFilterId === 'none') return !summary.currentRank;
    if (rankFilterId === 'near_wathab') {
      return (
        !!wathabRank &&
        summary.totalApprovedPages < wathabRank.requiredPages &&
        summary.totalApprovedPages >= Math.floor(wathabRank.requiredPages * 0.65)
      );
    }
    return summary.tiers.some(
      (t) => t.rank.id === rankFilterId && t.status === 'earned'
    );
  });

  // ------------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------------
  const handleApproveLog = (log: ReadingLog) => {
    if (!currentStaff) return;
    const res = approveReadingLog({ logId: log.id, staffId: currentStaff.id });
    if (res.success) {
      const rankMsg =
        res.newlyEarnedRanks && res.newlyEarnedRanks.length > 0
          ? ` — وترقّى الطالب إلى: ${res.newlyEarnedRanks.join('، ')} 🏆`
          : '';
      showToast(
        `تم اعتماد ${res.pagesApproved} صفحة بنجاح${rankMsg}`,
        'success'
      );
    } else {
      showToast(res.error || 'تعذر الاعتماد', 'error');
    }
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalLog || !currentStaff) return;
    const res = rejectReadingLog({
      logId: rejectModalLog.id,
      staffId: currentStaff.id,
      reason: rejectReason,
    });
    if (res.success) {
      showToast('تم رفض طلب القراءة وتوثيق السبب للطالب', 'info');
      setRejectModalLog(null);
      setRejectReason('');
    } else {
      showToast(res.error || 'تعذر الرفض', 'error');
    }
  };

  const handleCorrectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctModalLog || !currentStaff) return;
    const res = correctReadingLog({
      logId: correctModalLog.id,
      staffId: currentStaff.id,
      newFromPage: corrFromPage,
      newToPage: corrToPage,
      reason: corrReason,
    });
    if (res.success) {
      showToast('تم حفظ التصحيح الموثق وإعادة تقييم الألقاب دون حذف السجل القديم', 'success');
      setCorrectModalLog(null);
      setCorrReason('');
    } else {
      showToast(res.error || 'تعذر تنفيذ التصحيح', 'error');
    }
  };

  const handleReissueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reissueModalTarget || !currentStaff) return;
    const res = reissueCertificate({
      studentId: reissueModalTarget.studentId,
      rankId: reissueModalTarget.rankId,
      staffId: currentStaff.id,
      reason: reissueReason,
    });
    if (res.success && res.certificate) {
      showToast(
        `تم إعادة إصدار الشهادة برقم ${res.certificate.certificateNumber} وأرشفة النسخة السابقة`,
        'success'
      );
      setReissueModalTarget(null);
      setReissueReason('');
      setViewerCert(res.certificate);
    } else {
      showToast(res.error || 'تعذر إعادة الإصدار', 'error');
    }
  };

  const openAddRankModal = () => {
    setEditingRank(null);
    setRankForm({
      code: `RANK_${readingRanks.length + 1}`,
      orderIndex: readingRanks.length + 1,
      title: '',
      subtitle: 'مرتبة قرائية جديدة',
      requiredPages: 1200,
      description: '',
      motivationalPhrase: '',
      themeKey: 'custom',
      primaryColor: '#3b707d',
      secondaryColor: '#e3ecf3',
      accentColor: '#d4af37',
      badgeTitle: 'وسام التميز القرائي',
      certificateHeading: 'شهادة إنجاز قرائي',
      isHighestTier: false,
      isActive: true,
    });
    setRankModalOpen(true);
  };

  const openEditRankModal = (r: ReadingRankDefinition) => {
    setEditingRank(r);
    setRankForm({
      code: r.code,
      orderIndex: r.orderIndex,
      title: r.title,
      subtitle: r.subtitle,
      requiredPages: r.requiredPages,
      description: r.description,
      motivationalPhrase: r.motivationalPhrase,
      themeKey: r.themeKey,
      primaryColor: r.primaryColor,
      secondaryColor: r.secondaryColor,
      accentColor: r.accentColor,
      badgeTitle: r.badgeTitle,
      certificateHeading: r.certificateHeading,
      isHighestTier: r.isHighestTier,
      isActive: r.isActive,
    });
    setRankModalOpen(true);
  };

  const handleSaveRank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rankForm.title.trim() || rankForm.requiredPages <= 0) {
      showToast('يرجى كتابة اسم اللقب وعدد الصفحات المطلوبة', 'error');
      return;
    }
    if (editingRank) {
      updateReadingRank({
        ...editingRank,
        ...rankForm,
      });
      showToast(`تم تحديث لقب "${rankForm.title}" بنجاح`, 'success');
    } else {
      addReadingRank(rankForm);
      showToast(`تمت إضافة لقب "${rankForm.title}" بنجاح`, 'success');
    }
    setRankModalOpen(false);
  };

  const handleMoveRank = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sortedAllRanks.length) return;
    const copy = [...sortedAllRanks];
    const tmp = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = tmp;
    reorderReadingRanks(copy.map((r) => r.id));
    showToast('تم تعديل ترتيب الألقاب', 'success');
  };

  const handleExportReport = () => {
    const studentRows = studentSummaries.map(({ student, summary }) => ({
      'الرقم التعريفي': student.internalId,
      'اسم الطالب': student.fullName,
      'الصف': student.grade,
      'المجموعة': student.groupName,
      'الصفحات المعتمدة': summary.totalApprovedPages,
      'اللقب الحالي': summary.currentRank?.title || 'لم يبلغ أول لقب بعد',
      'اللقب القادم': summary.nextRank?.title || 'أتم جميع المراتب',
      'المتبقي للقادم (صفحة)': summary.remainingPagesToNext,
      'الشهادات الصادرة': summary.certificates.length,
      'رتبة وثّاب': summary.isWathabAchieved ? 'نعم 👑' : 'لا',
    }));

    const certRows = scopedReadingCertificates.map((c) => ({
      'رقم الشهادة': c.certificateNumber,
      'اسم الطالب': c.studentNameSnapshot,
      'اللقب': c.rankTitleSnapshot,
      'الصفحات المعتمدة': c.pagesCompletedSnapshot,
      'تاريخ الإصدار': formatArabicDate(c.issuedAt),
      'رقم الإصدار': c.version,
      'إعادة إصدار؟': c.isReissue ? 'نعم' : 'لا',
      'الحالة': c.status === 'active' ? 'سارية' : 'مؤرشفة',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'الألقاب وتقدم الطلاب');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(certRows), 'سجل الشهادات');
    XLSX.writeFile(wb, `تقرير-الألقاب-والشهادات-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('تم تصدير تقرير الألقاب والشهادات بصيغة Excel بنجاح', 'success');
  };

  const handlePrintSummary = () => {
    const rowsHtml = studentSummaries
      .map(
        ({ student, summary }) => `
        <tr>
          <td>${student.internalId}</td>
          <td>${student.fullName}</td>
          <td>${student.grade}</td>
          <td>${summary.totalApprovedPages}</td>
          <td>${summary.currentRank?.title || '-'}</td>
          <td>${summary.certificates.length}</td>
        </tr>`
      )
      .join('');

    printDirectReport(
      'تقرير الألقاب والشهادات القرائية الشامل',
      `<table>
        <thead>
          <tr>
            <th>الرقم</th><th>اسم الطالب</th><th>الصف</th><th>الصفحات المعتمدة</th><th>اللقب الحالي</th><th>الشهادات</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`
    );
  };

  return (
    <div className="space-y-6">
      {/* الترويسة */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-wathba-50 text-wathba-800 text-xs font-bold border border-wathba-200">
            <Award className="w-4 h-4 text-wathba-700" />
            <span>منظومة الألقاب الخمسة والشهادات الإلكترونية</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            إدارة الألقاب والشهادات القرائية
          </h2>
          <p className="text-xs text-slate-500">
            اعتماد صفحات القراءة، تخصيص الألقاب وقوالب الشهادات، متابعة الطلاب القريبين من «وثّاب»، وإصدار التقارير
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('admin_navigate_tab', { detail: 'achievements_leaderboard' })
              );
            }}
            icon={<Trophy className="w-4 h-4 text-amber-500" />}
            className="text-xs font-bold border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-amber-900"
          >
            لوحة الشرف والتنافس القرائي 🏆
          </Button>
          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              setSupLogInitialStudentId(undefined);
              setSupLogModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
            className="text-xs font-black"
          >
            تسجيل صفحات قراءة جديدة
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrintSummary}
            icon={<Printer className="w-4 h-4" />}
            className="text-xs font-bold"
          >
            طباعة التقرير
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportReport}
            icon={<Download className="w-4 h-4" />}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
          >
            تصدير Excel
          </Button>
        </div>
      </div>

      {/* شريط التنقل */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-[#e3ecf3] shadow-soft">
        <button
          type="button"
          onClick={() => setSubTab('stats_approvals')}
          className={`flex-1 min-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            subTab === 'stats_approvals'
              ? 'bg-[#3b707d] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>الإحصائيات وسجل القراءات ({pendingLogs.length > 0 ? pendingLogs.length : scopedReadingLogs.length})</span>
        </button>

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setSubTab('ranks_config')}
              className={`flex-1 min-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                subTab === 'ranks_config'
                  ? 'bg-[#3b707d] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>تخصيص الألقاب ({readingRanks.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('cert_templates')}
              className={`flex-1 min-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                subTab === 'cert_templates'
                  ? 'bg-[#3b707d] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>قوالب والجهة المصدرة للشهادات</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setSubTab('students_certs')}
          className={`flex-1 min-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            subTab === 'students_certs'
              ? 'bg-[#3b707d] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>سجل الطلاب والشهادات ({totalIssuedCerts})</span>
        </button>
      </div>

      {/* ================= TAB 1: لوحة الإحصائيات واعتماد القراءات ================= */}
      {subTab === 'stats_approvals' && (
        <div className="space-y-6">
          {/* مؤشرات لوحة إحصائيات الإدارة (Section 8) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-3xl p-4 border border-wathba-100 shadow-soft">
              <span className="text-[11px] text-slate-500 font-bold block">
                إجمالي الصفحات المعتمدة
              </span>
              <strong className="text-2xl font-black text-wathba-800 block mt-1">
                {totalApprovedPagesSystem.toLocaleString('ar-SA')} ص
              </strong>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-emerald-100 shadow-soft">
              <span className="text-[11px] text-slate-500 font-bold block">
                إجمالي الشهادات الصادرة
              </span>
              <strong className="text-2xl font-black text-emerald-700 block mt-1">
                {totalIssuedCerts} شهادة
              </strong>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-amber-100 shadow-soft">
              <span className="text-[11px] text-slate-500 font-bold block">
                دون اللقب الأول
              </span>
              <strong className="text-2xl font-black text-amber-700 block mt-1">
                {noFirstRankCount} طالب
              </strong>
            </div>

            <div className="bg-white rounded-3xl p-4 border border-purple-100 shadow-soft">
              <span className="text-[11px] text-slate-500 font-bold block">
                قريبون من لقب «وثّاب»
              </span>
              <strong className="text-2xl font-black text-purple-700 block mt-1">
                {nearWathabStudents.length} طالب
              </strong>
            </div>

            <div className="bg-gradient-to-l from-[#162b31] to-[#3b707d] text-white rounded-3xl p-4 shadow-soft">
              <span className="text-[11px] text-gold-300 font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>أكثر الطلاب تقدماً</span>
              </span>
              <strong className="text-sm font-black block mt-1 truncate">
                {topReader ? topReader.student.fullName : '-'}
              </strong>
              <span className="text-[11px] text-wathba-100">
                {topReader ? `${topReader.summary.totalApprovedPages} صفحة معتمدة` : ''}
              </span>
            </div>
          </div>

          {/* عدد الطلاب الحاصلين على كل لقب */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-3">
            <h3 className="font-black text-sm text-slate-900">
              توزيع الطلاب الحاصلين على الألقاب القرائية
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {rankCounts.map(({ rank, achievedCount }) => (
                <div
                  key={rank.id}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3"
                >
                  <RankEmblem
                    themeKey={rank.themeKey}
                    primaryColor={rank.primaryColor}
                    accentColor={rank.accentColor}
                    status="earned"
                    size="sm"
                  />
                  <div className="min-w-0">
                    <span className="font-black text-xs text-slate-900 block truncate">
                      {rank.title}
                    </span>
                    <span className="text-[11px] text-slate-500 font-bold">
                      {achievedCount} طالب ({rank.requiredPages} ص)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* تسجيل ومراجعة قراءات الطلاب */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#e3ecf3] shadow-sm">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-black text-sm text-slate-900">
                  توثيق ومراجعة صفحات القراءة
                </h3>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSupLogInitialStudentId(undefined);
                    setSupLogModalOpen(true);
                  }}
                  icon={<Plus className="w-4 h-4" />}
                  className="text-xs font-bold"
                >
                  تسجيل قراءة لطالب
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                {(
                  [
                    { id: 'approved', label: 'المعتمدة' },
                    { id: 'pending', label: `بانتظار الاعتماد (${pendingLogs.length})` },
                    { id: 'rejected', label: 'المرفوضة' },
                    { id: 'superseded', label: 'المصححة' },
                    { id: 'all', label: 'الكل' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLogStatusFilter(f.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl transition-all ${
                      logStatusFilter === f.id
                        ? 'bg-[#3b707d] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
                لا توجد طلبات قراءة ضمن هذه الفئة حالياً
              </div>
            ) : (
              filteredLogs.map((log) => {
                const student = students.find((s) => s.id === log.studentId);
                const book = books.find((b) => b.id === log.bookId);

                return (
                  <div
                    key={log.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-black text-sm text-slate-900">
                            {student?.fullName || 'طالب'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            ({student?.grade} • {student?.groupName})
                          </span>
                          <span className="text-[11px] text-slate-400">
                            تاريخ القراءة: {log.readingDate}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-wathba-700" />
                          <strong>{book?.title || 'كتاب مستعار'}</strong>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] font-bold">
                            من ص {log.fromPage} إلى ص {log.toPage} ({log.pagesCount} صفحة)
                          </span>
                        </div>
                      </div>

                      <div>
                        {log.status === 'pending' && (
                          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                            بانتظار الاعتماد (+{log.pagesCount} ص)
                          </span>
                        )}
                        {log.status === 'approved' && (
                          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            معتمد (+{log.pagesCount} ص)
                          </span>
                        )}
                        {log.status === 'rejected' && (
                          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold">
                            مرفوض
                          </span>
                        )}
                        {log.status === 'superseded' && (
                          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
                            معدّل بتصحيح موثق
                          </span>
                        )}
                      </div>
                    </div>

                    {log.studentNotes && (
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <strong>ملخص الطالب:</strong> {log.studentNotes}
                      </div>
                    )}

                    {log.status === 'rejected' && log.rejectionReason && (
                      <div className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                        <strong>سبب الرفض:</strong> {log.rejectionReason}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-400">
                        سُجّل في: {formatUmmAlQuraDate(log.createdAt)}
                      </span>

                      <div className="flex items-center gap-2">
                        {log.status === 'pending' && (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setRejectModalLog(log);
                                setRejectReason('');
                              }}
                              className="text-xs font-bold"
                            >
                              رفض
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApproveLog(log)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>اعتماد +{log.pagesCount} صفحة</span>
                            </Button>
                          </>
                        )}

                        {log.status === 'approved' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setCorrectModalLog(log);
                              setCorrFromPage(log.fromPage);
                              setCorrToPage(log.toPage);
                              setCorrReason('');
                            }}
                            className="text-xs font-bold flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5 text-wathba-700" />
                            <span>إجراء تصحيح موثق</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: تخصيص الألقاب الخمسة والمراتب (Admin) ================= */}
      {subTab === 'ranks_config' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-slate-900">
                مستويات الألقاب القرائية وحدود الصفحات
              </h3>
              <p className="text-xs text-slate-500">
                عدّل أسماء الألقاب، الصفحات المطلوبة، الألوان، الترتيب، أو أضف/أوقف لقباً
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={openAddRankModal}
              icon={<Plus className="w-4 h-4" />}
              className="bg-wathba-700 text-white text-xs font-bold"
            >
              إضافة لقب جديد
            </Button>
          </div>

          <div className="space-y-3">
            {sortedAllRanks.map((rank, idx, arr) => (
              <div
                key={rank.id}
                className={`bg-white rounded-2xl border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !rank.isActive
                    ? 'opacity-60 border-slate-200 bg-slate-50'
                    : rank.isHighestTier
                    ? 'border-gold-400 ring-1 ring-amber-200'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <RankEmblem
                    themeKey={rank.themeKey}
                    primaryColor={rank.primaryColor}
                    accentColor={rank.accentColor}
                    status="earned"
                    size="sm"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900">{rank.title}</h4>
                      {rank.isHighestTier && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black">
                          أعلى تصنيف
                        </span>
                      )}
                      {!rank.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                          متوقف
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      الحد المطلوب: <span className="text-wathba-700">{rank.requiredPages} صفحة</span> • {rank.badgeTitle}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveRank(idx, -1)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
                    title="تقديم"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === arr.length - 1}
                    onClick={() => handleMoveRank(idx, 1)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
                    title="تأخير"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateReadingRank({ ...rank, isActive: !rank.isActive })
                    }
                    className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1 ${
                      rank.isActive
                        ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{rank.isActive ? 'إيقاف' : 'تفعيل'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditRankModal(rank)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const res = deleteReadingRank(rank.id);
                      if (res.success) showToast(`تم حذف ${rank.title}`, 'info');
                      else showToast(res.error || 'تعذر الحذف', 'error');
                    }}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: قوالب والجهة المصدرة للشهادات (Admin) ================= */}
      {subTab === 'cert_templates' && isAdmin && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-black text-base text-slate-900">
              إعدادات الجهة المصدرة وتوقيع الشهادات الإلكترونية
            </h3>
            <p className="text-xs text-slate-500">
              تُطبق هذه البيانات على جميع الشهادات الجديدة والمعاد إصدارها
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                اسم الجهة المصدرة للشهادة:
              </label>
              <input
                type="text"
                value={certificateSettings.issuerOrganization}
                onChange={(e) =>
                  updateCertificateSettings({ issuerOrganization: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                المسمى التوقيعي (الصفة الرسمية):
              </label>
              <input
                type="text"
                value={certificateSettings.signatoryTitle}
                onChange={(e) =>
                  updateCertificateSettings({ signatoryTitle: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                اسم الموقّع أو الجهة المعتمدة:
              </label>
              <input
                type="text"
                value={certificateSettings.signatoryName}
                onChange={(e) =>
                  updateCertificateSettings({ signatoryName: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                بادئة رقم الشهادة الفريد:
              </label>
              <input
                type="text"
                value={certificateSettings.serialPrefix}
                onChange={(e) =>
                  updateCertificateSettings({ serialPrefix: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1.5">
                نص التذييل التوثيقي أسفل الشهادة:
              </label>
              <input
                type="text"
                value={certificateSettings.footerNote}
                onChange={(e) =>
                  updateCertificateSettings({ footerNote: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              variant="primary"
              size="md"
              onClick={() => showToast('تم حفظ بيانات إصدار الشهادات بنجاح', 'success')}
              className="bg-wathba-700 text-white text-xs font-bold"
            >
              اعتماد إعدادات الشهادة
            </Button>
          </div>
        </div>
      )}

      {/* ================= TAB 4: سجل الطلاب والشهادات والتصفية وإعادة الإصدار ================= */}
      {subTab === 'students_certs' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#e3ecf3] p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="ابحث باسم الطالب أو الرقم التعريفي..."
                className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-wathba-500"
              />
            </div>

            <select
              value={rankFilterId}
              onChange={(e) => setRankFilterId(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
            >
              <option value="all">جميع الطلاب والمراتب</option>
              <option value="none">الطلاب دون اللقب الأول ({noFirstRankCount})</option>
              <option value="near_wathab">القريبون من لقب وثّاب ({nearWathabStudents.length})</option>
              {activeSortedRanks.map((r) => (
                <option key={r.id} value={r.id}>
                  الحاصلون على: {r.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filteredStudentSummaries.map(({ student, summary }) => (
              <div
                key={student.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900">
                        {student.fullName}
                      </h4>
                      <span className="font-mono text-[11px] text-slate-400">
                        {student.internalId}
                      </span>
                      {summary.isWathabAchieved && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-gold-400 text-[10px] font-black flex items-center gap-1">
                          <Crown className="w-3 h-3" />
                          <span>وثّاب</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {student.grade} • {student.groupName} •{' '}
                      <strong className="text-wathba-800">
                        {summary.totalApprovedPages} صفحة معتمدة
                      </strong>{' '}
                      {summary.nextRank
                        ? `• متبقي ${summary.remainingPagesToNext} ص على ${summary.nextRank.title}`
                        : '• أتم جميع الألقاب!'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:justify-end shrink-0">
                    <div className="text-right sm:text-left">
                      <span className="text-[10px] text-slate-400 block">اللقب الحالي:</span>
                      <strong className="text-xs font-black text-[#3b707d]">
                        {summary.currentRank?.title || 'لم يحقق أول لقب بعد'}
                      </strong>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSupLogInitialStudentId(student.id);
                        setSupLogModalOpen(true);
                      }}
                      icon={<Plus className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                    >
                      تسجيل قراءة
                    </Button>
                  </div>
                </div>

                {/* الشهادات الصادرة لهذا الطالب + زر إعادة الإصدار */}
                {summary.certificates.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 block">
                      الشهادات الصادرة في ملف الطالب:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {summary.certificates.map((cert) => (
                        <div
                          key={cert.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs"
                        >
                          <span className="font-black text-slate-800">
                            {cert.rankTitleSnapshot}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            #{cert.version} ({cert.certificateNumber})
                          </span>
                          <button
                            type="button"
                            onClick={() => setViewerCert(cert)}
                            className="p-1 rounded-lg bg-wathba-100 text-wathba-800 hover:bg-wathba-200"
                            title="عرض الشهادة"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {cert.status === 'active' && isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setReissueModalTarget({
                                  studentId: student.id,
                                  studentName: student.fullName,
                                  rankId: cert.rankId,
                                  rankTitle: cert.rankTitleSnapshot,
                                });
                                setReissueReason('');
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-[10px] font-bold flex items-center gap-1"
                              title="إعادة إصدار الشهادة من جديد مع حفظ السابقة"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>إعادة إصدار</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}
      <SupervisorLogReadingModal
        isOpen={supLogModalOpen}
        onClose={() => setSupLogModalOpen(false)}
        initialStudentId={supLogInitialStudentId}
      />

      {viewerCert && (
        <CertificateViewerModal
          isOpen={!!viewerCert}
          onClose={() => setViewerCert(null)}
          certificate={viewerCert}
        />
      )}

      {/* Reject Log Modal */}
      {rejectModalLog && (
        <Modal
          isOpen={!!rejectModalLog}
          onClose={() => setRejectModalLog(null)}
          title="رفض طلب تسجيل القراءة"
          subtitle="لن تُحتسب أي صفحات من هذا الطلب"
          maxWidth="sm"
        >
          <form onSubmit={handleRejectSubmit} className="space-y-4 text-right">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              required
              placeholder="اكتب سبب الرفض ليظهر للطالب..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setRejectModalLog(null)}>
                إلغاء
              </Button>
              <Button type="submit" variant="danger" size="sm">
                تأكيد الرفض
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Audited Correction Modal */}
      {correctModalLog && (
        <Modal
          isOpen={!!correctModalLog}
          onClose={() => setCorrectModalLog(null)}
          title="تصحيح موثق لسجل قراءة معتمد"
          subtitle="يحفظ السجل الأصلي ويعيد حساب ألقاب الطالب بأمان"
          maxWidth="md"
        >
          <form onSubmit={handleCorrectionSubmit} className="space-y-4 text-right">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              الأصلي: من ص {correctModalLog.fromPage} إلى ص {correctModalLog.toPage} ({correctModalLog.pagesCount} صفحة)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">من صفحة:</label>
                <input
                  type="number"
                  min={1}
                  value={corrFromPage}
                  onChange={(e) => setCorrFromPage(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">إلى صفحة:</label>
                <input
                  type="number"
                  min={corrFromPage}
                  value={corrToPage}
                  onChange={(e) => setCorrToPage(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                />
              </div>
            </div>
            <textarea
              value={corrReason}
              onChange={(e) => setCorrReason(e.target.value)}
              rows={2}
              required
              placeholder="سبب التصحيح الإداري (إلزامي)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setCorrectModalLog(null)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-wathba-700 text-white font-bold">
                حفظ التصحيح الموثق
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Re-issue Certificate Modal */}
      {reissueModalTarget && (
        <Modal
          isOpen={!!reissueModalTarget}
          onClose={() => setReissueModalTarget(null)}
          title={`إعادة إصدار شهادة: ${reissueModalTarget.rankTitle}`}
          subtitle={`للطالب: ${reissueModalTarget.studentName} — تُحفظ الشهادة السابقة في الأرشيف`}
          maxWidth="sm"
        >
          <form onSubmit={handleReissueSubmit} className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سبب إعادة الإصدار (إلزامي للتوثيق):
              </label>
              <textarea
                value={reissueReason}
                onChange={(e) => setReissueReason(e.target.value)}
                rows={3}
                required
                placeholder="مثال: تحديث اسم الطالب أو تحديث القالب والتوقيع المعتمد..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setReissueModalTarget(null)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-wathba-700 text-white font-bold">
                إصدار النسخة الجديدة
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add/Edit Rank Modal */}
      {rankModalOpen && (
        <Modal
          isOpen={rankModalOpen}
          onClose={() => setRankModalOpen(false)}
          title={editingRank ? `تعديل لقب: ${editingRank.title}` : 'إضافة لقب قرائي جديد'}
          subtitle="تخصيص اسم المرتبة، الصفحات المطلوبة، الألوان، وعبارة الشهادة"
          maxWidth="lg"
        >
          <form onSubmit={handleSaveRank} className="space-y-4 text-right text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم اللقب:</label>
                <input
                  type="text"
                  required
                  value={rankForm.title}
                  onChange={(e) => setRankForm({ ...rankForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الصفحات المطلوبة:</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={rankForm.requiredPages}
                  onChange={(e) =>
                    setRankForm({ ...rankForm, requiredPages: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-black"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">مسمى الوسام / الشارة:</label>
                <input
                  type="text"
                  value={rankForm.badgeTitle}
                  onChange={(e) => setRankForm({ ...rankForm, badgeTitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نموذج التصميم الجاهز:</label>
                <select
                  value={rankForm.themeKey}
                  onChange={(e) => {
                    const key = e.target.value as ReadingRankThemeKey;
                    const preset = RANK_THEME_PRESETS[key];
                    setRankForm({
                      ...rankForm,
                      themeKey: key,
                      primaryColor: preset.primaryColor,
                      secondaryColor: preset.secondaryColor,
                      accentColor: preset.accentColor,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white"
                >
                  {Object.entries(RANK_THEME_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اللون الأساسي:</label>
                <input
                  type="color"
                  value={rankForm.primaryColor}
                  onChange={(e) => setRankForm({ ...rankForm, primaryColor: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-200 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اللون الثانوي:</label>
                <input
                  type="color"
                  value={rankForm.secondaryColor}
                  onChange={(e) => setRankForm({ ...rankForm, secondaryColor: e.target.value })}
                  className="w-full h-9 rounded-xl border border-slate-200 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">وصف المرتبة للطلاب:</label>
              <textarea
                value={rankForm.description}
                onChange={(e) => setRankForm({ ...rankForm, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">العبارة التحفيزية داخل الشهادة:</label>
              <textarea
                value={rankForm.motivationalPhrase}
                onChange={(e) =>
                  setRankForm({ ...rankForm, motivationalPhrase: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 rounded-xl border border-slate-200"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rankForm.isHighestTier}
                  onChange={(e) => setRankForm({ ...rankForm, isHighestTier: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <span>تمييز كأعلى تصنيف قرائي (احتفال خاص ووسام رقمي حصري)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" size="md" onClick={() => setRankModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="md" className="bg-wathba-700 text-white font-bold">
                حفظ اللقب
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
