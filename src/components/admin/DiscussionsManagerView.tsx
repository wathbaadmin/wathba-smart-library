import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatArabicDate, formatArabicDateTime, formatUmmAlQuraDate } from '../../lib/dateUtils';
import {
  getDiscussionStatusMeta,
  normalizeDiscussionStatus,
  getActiveEvaluationTemplate,
  filterStudentsForStaffScope,
} from '../../lib/discussionUtils';
import {
  ReadingDiscussion,
  DiscussionEvaluationItem,
  DiscussionGroup,
} from '../../types';
import {
  MessageSquareText,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Eye,
  Plus,
  Award,
  RotateCw,
  XCircle,
  BookOpen,
  Star,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export interface DiscussionsManagerViewProps {
  initialSubTab?: 'list' | 'groups';
  initialStatusFilter?: string;
}

export const DiscussionsManagerView: React.FC<DiscussionsManagerViewProps> = ({
  initialSubTab = 'list',
  initialStatusFilter = 'all',
}) => {
  const { currentStaff } = useAuth();
  const {
    discussions,
    discussionGroups,
    discussionSettings,
    students,
    books,
    staff,
    loans,
    copies,
    scheduleDiscussion,
    recordDiscussionResult,
    approveDiscussion,
    requestRediscussion,
    cancelDiscussion,
    createDiscussionGroup,
    canStaffApproveDiscussion,
    getBookReadingCoverage,
  } = useLibrary();
  const { showToast, addNotification } = useNotifications();

  // Retrieve live staff record so permission changes apply immediately
  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const canApprove = canStaffApproveDiscussion(liveStaff);

  const [subTab, setSubTab] = useState<'list' | 'groups'>(initialSubTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState<'all' | 'individual' | 'group'>('all');

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  // Detail & Workflow Modal state
  const [selectedDisc, setSelectedDisc] = useState<ReadingDiscussion | null>(null);
  const [scheduleDateInput, setScheduleDateInput] = useState('');
  const [scheduleNoteInput, setScheduleNoteInput] = useState('');
  const [summaryInput, setSummaryInput] = useState('');
  const [benefitInput, setBenefitInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [recommendationsInput, setRecommendationsInput] = useState('');
  const [evalInputs, setEvalInputs] = useState<DiscussionEvaluationItem[]>([]);
  const [customPointsInput, setCustomPointsInput] = useState<number>(discussionSettings.pointsPerDiscussion);
  const [actionReasonInput, setActionReasonInput] = useState('');

  // Group Discussion Create & Evaluate Modals
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitleInput, setGroupTitleInput] = useState('');
  const [groupBookIdInput, setGroupBookIdInput] = useState(books[0]?.id || '');
  const [groupStudentIds, setGroupStudentIds] = useState<string[]>([]);
  const [groupScheduledDate, setGroupScheduledDate] = useState('');
  const [groupScheduledNote, setGroupScheduledNote] = useState('');
  const [activeGroupModal, setActiveGroupModal] = useState<DiscussionGroup | null>(null);

  const visibleStudents = filterStudentsForStaffScope(students, liveStaff);
  const visibleStudentIds = new Set(visibleStudents.map((s) => s.id));

  const scopedDiscussions = discussions.filter(
    (d) => !liveStaff?.assignedGroups?.length || visibleStudentIds.has(d.studentId)
  );

  // Live selected discussion sync
  const currentModalDisc = selectedDisc
    ? discussions.find((d) => d.id === selectedDisc.id) || selectedDisc
    : null;

  useEffect(() => {
    if (!currentModalDisc) return;
    const activeTpl = getActiveEvaluationTemplate(discussionSettings);
    if (currentModalDisc.evaluation && currentModalDisc.evaluation.length > 0) {
      setEvalInputs(currentModalDisc.evaluation);
    } else {
      setEvalInputs(
        activeTpl.items.map((it) => ({
          name: it.name,
          maxPoints: it.maxPoints,
          awardedPoints: 0,
        }))
      );
    }
    setScheduleDateInput(currentModalDisc.scheduledDate ? currentModalDisc.scheduledDate.slice(0, 10) : '');
    setScheduleNoteInput(currentModalDisc.scheduledNote || '');
    setSummaryInput(currentModalDisc.discussionSummary || '');
    setBenefitInput(currentModalDisc.studentBenefit || '');
    setNotesInput(currentModalDisc.supervisorNotes || '');
    setRecommendationsInput(currentModalDisc.supervisorRecommendations || '');
    setActionReasonInput('');

    const totalScore = (currentModalDisc.evaluation || []).reduce((s, e) => s + e.awardedPoints, 0);
    const maxScore = activeTpl.totalMaxPoints || discussionSettings.totalMaxPoints || 100;
    const suggestedPts =
      discussionSettings.pointsCalculationMode === 'proportional'
        ? Math.max(0, Math.round((totalScore / maxScore) * (discussionSettings.pointsPerDiscussion || 10)))
        : discussionSettings.pointsPerDiscussion || 10;
    setCustomPointsInput(currentModalDisc.pointsAwarded || suggestedPts);
  }, [selectedDisc?.id]);

  // Stats
  const awaitingCount = scopedDiscussions.filter((d) => {
    const s = normalizeDiscussionStatus(d.status);
    return s === 'requested' || s === 'awaiting_schedule';
  }).length;
  const scheduledCount = scopedDiscussions.filter((d) => normalizeDiscussionStatus(d.status) === 'scheduled').length;
  const pendingApprovalCount = scopedDiscussions.filter((d) => {
    const s = normalizeDiscussionStatus(d.status);
    return s === 'pending_approval' || s === 'discussed';
  }).length;
  const approvedCount = scopedDiscussions.filter((d) => d.status === 'approved').length;

  const filteredDiscussions = scopedDiscussions
    .filter((d) => {
      const stu = students.find((s) => s.id === d.studentId);
      const bk = books.find((b) => b.id === d.bookId);
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        stu?.fullName.toLowerCase().includes(term) ||
        stu?.groupName.toLowerCase().includes(term) ||
        bk?.title.toLowerCase().includes(term);

      const normStatus = normalizeDiscussionStatus(d.status);
      const matchStatus = statusFilter === 'all' || normStatus === statusFilter;
      const matchType = typeFilter === 'all' || d.type === typeFilter;
      return matchSearch && matchStatus && matchType;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getPreviousDiscussionsCount = (studentId: string, currentId: string) =>
    discussions.filter((d) => d.studentId === studentId && d.id !== currentId).length;

  const totalLiveScore = evalInputs.reduce((sum, it) => sum + (Number(it.awardedPoints) || 0), 0);
  const totalLiveMax = evalInputs.reduce((sum, it) => sum + (Number(it.maxPoints) || 0), 0) || 100;
  const computedSuggestedPoints =
    totalLiveScore < (discussionSettings.minPassingScore ?? 50)
      ? 0
      : discussionSettings.pointsCalculationMode === 'proportional'
      ? Math.max(1, Math.round((totalLiveScore / totalLiveMax) * (discussionSettings.pointsPerDiscussion || 10)))
      : discussionSettings.pointsPerDiscussion || 10;

  const notifyStudent = (studentId: string, title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    if (discussionSettings.enableNotifications === false) return;
    addNotification({
      recipientType: 'student',
      studentId,
      title,
      message,
      type,
      actionLink: 'my_discussions',
    });
  };

  const handleScheduleSubmit = () => {
    if (!currentModalDisc || !liveStaff) return;
    if (!scheduleDateInput) {
      showToast('يرجى اختيار تاريخ المناقشة', 'warning');
      return;
    }
    const isoDate = scheduleDateInput.includes('T') ? scheduleDateInput : `${scheduleDateInput}T12:00:00.000Z`;
    const res = scheduleDiscussion({
      discussionId: currentModalDisc.id,
      supervisorId: liveStaff.id,
      scheduledDate: isoDate,
      scheduledNote: scheduleNoteInput,
    });
    if (res.success) {
      const bk = books.find((b) => b.id === currentModalDisc.bookId);
      notifyStudent(
        currentModalDisc.studentId,
        'تم تحديد موعد مناقشة كتابك 📅',
        `تم تحديد موعد مناقشة كتاب "${bk?.title || ''}" يوم: ${formatArabicDate(isoDate)}.`,
        'info'
      );
      showToast('تم تحديد موعد المناقشة بنجاح', 'success');
    } else {
      showToast(res.error || 'تعذر تحديد الموعد', 'error');
    }
  };

  const handleSaveEvaluation = (andApprove: boolean) => {
    if (!currentModalDisc || !liveStaff) return;
    const activeTpl = getActiveEvaluationTemplate(discussionSettings);
    const res = recordDiscussionResult({
      discussionId: currentModalDisc.id,
      supervisorId: liveStaff.id,
      discussionSummary: summaryInput,
      evaluation: evalInputs,
      studentBenefit: benefitInput,
      notes: notesInput,
      recommendations: recommendationsInput,
      templateId: activeTpl.id,
      templateName: activeTpl.name,
      autoApproveIfAllowed: andApprove,
    });

    if (res.success) {
      const bk = books.find((b) => b.id === currentModalDisc.bookId);
      if (andApprove && canApprove) {
        notifyStudent(
          currentModalDisc.studentId,
          'تم اعتماد مناقشتك وإضافة النقاط! 🏆',
          `مبارك! اعتُمدت مناقشة كتاب "${bk?.title || ''}" بدرجة ${totalLiveScore}/${totalLiveMax} وأضيفت ${computedSuggestedPoints} نقطة.`,
          'success'
        );
        showToast(`تم تسجيل النتيجة واعتمادها وإضافة ${computedSuggestedPoints} نقطة للطالب!`, 'success');
      } else {
        showToast('تم حفظ تقييم المناقشة (بانتظار الاعتماد النهائي لإضافة النقاط)', 'success');
      }
      setSelectedDisc(null);
    } else {
      showToast(res.error || 'تعذر حفظ التقييم', 'error');
    }
  };

  const handleApproveOnly = () => {
    if (!currentModalDisc || !liveStaff) return;
    const res = approveDiscussion({
      discussionId: currentModalDisc.id,
      staffId: liveStaff.id,
      pointsAwarded: customPointsInput,
    });
    if (res.success) {
      const bk = books.find((b) => b.id === currentModalDisc.bookId);
      notifyStudent(
        currentModalDisc.studentId,
        'تم اعتماد نتيجة المناقشة 🏆',
        `اعتُمدت نتيجة مناقشة كتاب "${bk?.title || ''}" وأضيفت ${customPointsInput} نقطة إلى رصيدك.`,
        'success'
      );
      showToast(`تم اعتماد المناقشة وإضافة ${customPointsInput} نقطة بنجاح`, 'success');
      setSelectedDisc(null);
    } else {
      showToast(res.error || 'تعذر الاعتماد', 'error');
    }
  };

  const handleRequestRediscuss = () => {
    if (!currentModalDisc || !liveStaff) return;
    if (!actionReasonInput.trim()) {
      showToast('يرجى كتابة سبب طلب إعادة المناقشة', 'warning');
      return;
    }
    const res = requestRediscussion({
      discussionId: currentModalDisc.id,
      staffId: liveStaff.id,
      reason: actionReasonInput,
    });
    if (res.success) {
      const bk = books.find((b) => b.id === currentModalDisc.bookId);
      notifyStudent(
        currentModalDisc.studentId,
        'ملاحظة حول مناقشة كتابك 🔄',
        `يوصي المشرف بإعادة مناقشة كتاب "${bk?.title || ''}". السبب: ${actionReasonInput.trim()}`,
        'warning'
      );
      showToast('تم تحويل الحالة إلى "تحتاج إلى إعادة مناقشة"', 'info');
      setSelectedDisc(null);
    } else {
      showToast(res.error || 'تعذر تنفيذ الطلب', 'error');
    }
  };

  const handleCancelDiscussion = () => {
    if (!currentModalDisc || !liveStaff) return;
    if (!actionReasonInput.trim()) {
      showToast('يرجى كتابة سبب الإلغاء', 'warning');
      return;
    }
    const res = cancelDiscussion({
      discussionId: currentModalDisc.id,
      staffId: liveStaff.id,
      reason: actionReasonInput,
    });
    if (res.success) {
      showToast('تم إلغاء المناقشة', 'info');
      setSelectedDisc(null);
    } else {
      showToast(res.error || 'تعذر الإلغاء', 'error');
    }
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveStaff) return;
    const res = createDiscussionGroup({
      bookId: groupBookIdInput,
      supervisorId: liveStaff.id,
      title: groupTitleInput,
      studentIds: groupStudentIds,
      scheduledDate: groupScheduledDate ? new Date(groupScheduledDate).toISOString() : undefined,
      scheduledNote: groupScheduledNote,
    });
    if (res.success) {
      showToast(`تم إنشاء المناقشة الجماعية بمشاركة ${groupStudentIds.length} طلاب بنجاح`, 'success');
      setCreateGroupOpen(false);
      setGroupTitleInput('');
      setGroupStudentIds([]);
      setGroupScheduledDate('');
      setGroupScheduledNote('');
      setSubTab('groups');
    } else {
      showToast(res.error || 'تعذر إنشاء المناقشة الجماعية', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-wathba-100 text-wathba-800">
              <MessageSquareText className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">المناقشات القرائية (فردية وجماعية)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            استقبال طلبات مناقشة الكتب، تحديد المواعيد، تقييم استيعاب الطالب وفق العناصر الخمسة، واعتماد النقاط المكتسبة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {discussionSettings.allowGroupDiscussions !== false && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateGroupOpen(true)}
            >
              إنشاء مناقشة جماعية
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-soft">
          <span className="text-[11px] font-bold text-slate-500 block">بانتظار تحديد الموعد</span>
          <strong className="text-2xl font-black text-amber-700 mt-1 block">{awaitingCount}</strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-soft">
          <span className="text-[11px] font-bold text-slate-500 block">مناقشات مجدولة</span>
          <strong className="text-2xl font-black text-blue-700 mt-1 block">{scheduledCount}</strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-soft">
          <span className="text-[11px] font-bold text-slate-500 block">بانتظار اعتماد النتيجة</span>
          <strong className="text-2xl font-black text-purple-700 mt-1 block">{pendingApprovalCount}</strong>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-soft">
          <span className="text-[11px] font-bold text-slate-500 block">مناقشات معتمدة</span>
          <strong className="text-2xl font-black text-emerald-700 mt-1 block">{approvedCount}</strong>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-soft">
        <button
          type="button"
          onClick={() => setSubTab('list')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            subTab === 'list' ? 'bg-wathba-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquareText className="w-4 h-4" />
          <span>سجل المناقشات والطلبات ({scopedDiscussions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('groups')}
          className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            subTab === 'groups' ? 'bg-[#3b707d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>المناقشات الجماعية ({discussionGroups.length})</span>
        </button>
      </div>

      {subTab === 'list' && (
        <>
          {/* Filter Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e3ecf3] shadow-soft flex flex-col md:flex-row md:flex-wrap md:items-center gap-2.5 text-xs">
            <div className="relative w-full md:flex-1 md:min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث باسم الطالب، المجموعة، أو عنوان الكتاب..."
                className="w-full min-h-[44px] pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full md:w-auto min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
              >
                <option value="all">جميع الحالات</option>
                <option value="awaiting_schedule">بانتظار تحديد الموعد</option>
                <option value="scheduled">تم تحديد الموعد</option>
                <option value="pending_approval">بانتظار اعتماد النتيجة</option>
                <option value="approved">معتمدة</option>
                <option value="needs_rediscussion">تحتاج إلى إعادة مناقشة</option>
                <option value="cancelled">ملغاة</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="w-full md:w-auto min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
              >
                <option value="all">فردية وجماعية</option>
                <option value="individual">مناقشات فردية</option>
                <option value="group">مناقشات جماعية</option>
              </select>
            </div>
          </div>

          {/* Mobile Discussions Cards */}
          <div className="md:hidden space-y-3">
            {filteredDiscussions.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#e3ecf3] p-10 text-center text-slate-400 text-xs shadow-soft">
                لا توجد طلبات أو سجلات مناقشة مطابقة حالياً
              </div>
            ) : (
              filteredDiscussions.map((disc) => {
                const stu = students.find((s) => s.id === disc.studentId);
                const bk = books.find((b) => b.id === disc.bookId);
                const statusMeta = getDiscussionStatusMeta(disc.status);
                const prevCount = getPreviousDiscussionsCount(disc.studentId, disc.id);

                return (
                  <div
                    key={disc.id}
                    className="bg-white rounded-2xl border border-[#e3ecf3] p-4 shadow-soft space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-black text-sm text-slate-900 truncate">{stu?.fullName || '-'}</div>
                        <div className="text-[11px] text-slate-500">{stu?.groupName || ''}</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${statusMeta.badgeClass}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="bg-[#f6f8fa] rounded-xl p-3 border border-[#e3ecf3]/70 space-y-1.5 text-xs">
                      <div className="font-bold text-slate-900">{bk?.title || '-'}</div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            disc.type === 'group'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {disc.type === 'group' ? 'مناقشة جماعية' : 'مناقشة فردية'}
                        </span>
                        <span>تاريخ الطلب: {formatArabicDate(disc.requestDate)}</span>
                        <span>• سابقة: <strong className="font-mono">{prevCount}</strong></span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                        <span className="text-slate-600">
                          الموعد:{' '}
                          {disc.scheduledDate ? (
                            <strong className="text-[#3b707d]">{formatArabicDate(disc.scheduledDate)}</strong>
                          ) : (
                            <span className="text-slate-400">لم يحدد</span>
                          )}
                        </span>
                        {disc.evaluation.length > 0 && (
                          <span className="font-black text-[#284d57]">
                            {disc.totalScore}/{disc.maxScore || 100}
                            {disc.status === 'approved' ? ` (+${disc.pointsAwarded} ن)` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      size="md"
                      variant="primary"
                      icon={<Eye className="w-4 h-4" />}
                      onClick={() => setSelectedDisc(disc)}
                      className="w-full"
                    >
                      عرض التفاصيل والإجراءات
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Discussions Table */}
          <div className="hidden md:block bg-white rounded-3xl border border-[#e3ecf3] overflow-hidden shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-[#f6f8fa] text-slate-700 font-black border-b border-[#e3ecf3]">
                  <tr>
                    <th className="p-4">اسم الطالب</th>
                    <th className="p-4">اسم الكتاب</th>
                    <th className="p-4">النوع</th>
                    <th className="p-4">تاريخ الطلب</th>
                    <th className="p-4">الموعد</th>
                    <th className="p-4">حالة المناقشة</th>
                    <th className="p-4 text-center">مناقشات سابقة</th>
                    <th className="p-4 text-center">الدرجة / النقاط</th>
                    <th className="p-4 text-center">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDiscussions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        لا توجد طلبات أو سجلات مناقشة مطابقة حالياً
                      </td>
                    </tr>
                  ) : (
                    filteredDiscussions.map((disc) => {
                      const stu = students.find((s) => s.id === disc.studentId);
                      const bk = books.find((b) => b.id === disc.bookId);
                      const statusMeta = getDiscussionStatusMeta(disc.status);
                      const prevCount = getPreviousDiscussionsCount(disc.studentId, disc.id);

                      return (
                        <tr key={disc.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{stu?.fullName || '-'}</div>
                            <div className="text-[10px] text-slate-500">{stu?.groupName || ''}</div>
                          </td>
                          <td className="p-4 font-bold text-slate-800 max-w-[200px] truncate">
                            {bk?.title || '-'}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                disc.type === 'group'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {disc.type === 'group' ? 'جماعية' : 'فردية'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600">{formatArabicDate(disc.requestDate)}</td>
                          <td className="p-4">
                            {disc.scheduledDate ? (
                              <span className="font-bold text-[#3b707d]">
                                {formatArabicDate(disc.scheduledDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400">لم يحدد</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusMeta.badgeClass}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-slate-700">
                            {prevCount}
                          </td>
                          <td className="p-4 text-center">
                            {disc.evaluation.length > 0 ? (
                              <div>
                                <span className="font-black text-[#284d57]">
                                  {disc.totalScore}/{disc.maxScore || 100}
                                </span>
                                {disc.status === 'approved' && (
                                  <span className="block text-[10px] font-bold text-emerald-700">
                                    +{disc.pointsAwarded} نقطة
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Eye className="w-3.5 h-3.5" />}
                              onClick={() => setSelectedDisc(disc)}
                              className="text-[11px] font-bold"
                            >
                              عرض التفاصيل
                            </Button>
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

      {subTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {discussionGroups.length === 0 ? (
            <div className="col-span-full bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              لم يتم إنشاء أي مناقشات جماعية بعد. اضغط «إنشاء مناقشة جماعية» للبدء.
            </div>
          ) : (
            discussionGroups.map((grp) => {
              const bk = books.find((b) => b.id === grp.bookId);
              const grpDiscs = discussions.filter((d) => d.groupId === grp.id);
              const approvedInGrp = grpDiscs.filter((d) => d.status === 'approved').length;

              return (
                <div key={grp.id} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        مناقشة جماعية
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1.5">{grp.title}</h3>
                      <p className="text-xs text-wathba-700 font-bold mt-0.5">{bk?.title || 'كتاب المكتبة'}</p>
                    </div>
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-xl">
                      {grpDiscs.length} طلاب
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 text-[10px] block">الموعد</span>
                      <strong className="text-slate-800">
                        {grp.scheduledDate ? formatArabicDate(grp.scheduledDate) : 'غير محدد'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">حالة التقييم المستقل</span>
                      <strong className="text-emerald-700">
                        تم اعتماد {approvedInGrp} من {grpDiscs.length}
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Users className="w-4 h-4" />}
                      onClick={() => setActiveGroupModal(grp)}
                    >
                      إدارة وتقييم الطلاب بشكل مستقل
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal: إدارة وتقييم مناقشة فردية أو عضو في مناقشة جماعية */}
      {currentModalDisc && (
        <Modal
          isOpen={!!currentModalDisc}
          onClose={() => setSelectedDisc(null)}
          title="ملف المناقشة القرائية والتقييم"
          subtitle={`${students.find((s) => s.id === currentModalDisc.studentId)?.fullName || ''} — ${
            books.find((b) => b.id === currentModalDisc.bookId)?.title || ''
          }`}
          maxWidth="4xl"
        >
          {(() => {
            const stu = students.find((s) => s.id === currentModalDisc.studentId);
            const bk = books.find((b) => b.id === currentModalDisc.bookId);
            const coverage = stu && bk ? getBookReadingCoverage(stu.id, bk.id) : null;
            const statusMeta = getDiscussionStatusMeta(currentModalDisc.status);
            const isApproved = currentModalDisc.status === 'approved';
            const isCancelled = currentModalDisc.status === 'cancelled';

            return (
              <div className="space-y-5 text-xs">
                {/* 1. بطاقة الطالب والكتاب */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-wathba-50/70 p-4 rounded-2xl border border-wathba-200">
                  <div>
                    <span className="text-slate-500 text-[10px] block">الطالب</span>
                    <strong className="text-sm text-slate-900">{stu?.fullName}</strong>
                    <span className="block text-[11px] text-wathba-800 font-bold">
                      {stu?.grade} • {stu?.groupName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">الكتاب وصفحاته</span>
                    <strong className="text-sm text-slate-900">{bk?.title}</strong>
                    {coverage && (
                      <span className="block text-[11px] text-emerald-700 font-bold">
                        الصفحات المعتمدة: {coverage.approvedPages} / {coverage.bookPageCount}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col justify-between items-start md:items-end">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.badgeClass}`}>
                      {statusMeta.label}
                    </span>
                    {currentModalDisc.type === 'group' && (
                      <span className="text-[11px] font-bold text-indigo-700 mt-1">
                        جزء من مناقشة جماعية (التقييم مستقل لكل طالب)
                      </span>
                    )}
                  </div>
                </div>

                {currentModalDisc.rediscussionReason && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    <strong>مبرر إعادة المناقشة:</strong> {currentModalDisc.rediscussionReason}
                  </div>
                )}

                {/* 2. تحديد الموعد */}
                {!isApproved && !isCancelled && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-wathba-600" />
                        <span>تحديد / تحديث موعد المناقشة (اليوم فقط)</span>
                      </h4>
                      <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        تاريخ اليوم فقط دون وقت أو ساعة
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="date"
                        value={scheduleDateInput}
                        onChange={(e) => setScheduleDateInput(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white"
                      />
                      <input
                        type="text"
                        value={scheduleNoteInput}
                        onChange={(e) => setScheduleNoteInput(e.target.value)}
                        placeholder="مكان أو ملاحظة الموعد (مثلاً: المكتبة - الفسحة)"
                        className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      />
                      <Button variant="royal" size="sm" onClick={handleScheduleSubmit}>
                        تثبيت الموعد وإشعار الطالب
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. نموذج التقييم من 100 وملخص المناقشة */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="font-black text-sm text-slate-900">نموذج تقييم المناقشة</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">المجموع التلقائي:</span>
                      <span className="px-3 py-1 rounded-xl bg-wathba-700 text-white font-black text-sm font-mono">
                        {totalLiveScore} / {totalLiveMax}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {evalInputs.map((ev, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <span className="font-bold text-slate-800">
                          {ev.name} <span className="text-slate-400 font-mono">(الحد الأقصى {ev.maxPoints})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            disabled={isApproved || isCancelled}
                            min={0}
                            max={ev.maxPoints}
                            value={ev.awardedPoints}
                            onChange={(e) => {
                              const val = Math.min(ev.maxPoints, Math.max(0, Number(e.target.value) || 0));
                              setEvalInputs((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, awardedPoints: val } : it))
                              );
                            }}
                            className="w-32 accent-[#3b707d]"
                          />
                          <input
                            type="number"
                            disabled={isApproved || isCancelled}
                            min={0}
                            max={ev.maxPoints}
                            value={ev.awardedPoints}
                            onChange={(e) => {
                              const val = Math.min(ev.maxPoints, Math.max(0, Number(e.target.value) || 0));
                              setEvalInputs((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, awardedPoints: val } : it))
                              );
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-slate-300 font-black text-center font-mono bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">ملخص المناقشة:</label>
                      <textarea
                        rows={2}
                        disabled={isApproved || isCancelled}
                        value={summaryInput}
                        onChange={(e) => setSummaryInput(e.target.value)}
                        placeholder="ملخص ما دار في المناقشة ومدى استيعاب الطالب..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">الفائدة التي خرج بها الطالب من الكتاب:</label>
                      <textarea
                        rows={2}
                        disabled={isApproved || isCancelled}
                        value={benefitInput}
                        onChange={(e) => setBenefitInput(e.target.value)}
                        placeholder="أبرز القيم والأفكار التي استخلصها الطالب..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">ملاحظات المشرف:</label>
                      <textarea
                        rows={2}
                        disabled={isApproved || isCancelled}
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        placeholder="تقييم الأداء والملاحظات المباشرة..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block">توصيات المشرف للفترة القادمة:</label>
                      <textarea
                        rows={2}
                        disabled={isApproved || isCancelled}
                        value={recommendationsInput}
                        onChange={(e) => setRecommendationsInput(e.target.value)}
                        placeholder="كتب مقترحة أو مهارات يُنصح بالتركيز عليها..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  {/* أزرار تسجيل النتيجة والاعتماد */}
                  {!isApproved && !isCancelled && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <div className="text-xs font-bold text-slate-600">
                        النقاط المقترحة عند الاعتماد:{' '}
                        <span className="text-emerald-700 font-black">{computedSuggestedPoints} نقطة</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSaveEvaluation(false)}
                        >
                          حفظ التقييم (بانتظار الاعتماد)
                        </Button>
                        {canApprove && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<CheckCircle2 className="w-4 h-4" />}
                            onClick={() => handleSaveEvaluation(true)}
                          >
                            حفظ واعتماد وإضافة النقاط (+{computedSuggestedPoints})
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. اعتماد مناقشة مكتملة (إذا كانت بانتظار الاعتماد) */}
                {(normalizeDiscussionStatus(currentModalDisc.status) === 'pending_approval' ||
                  normalizeDiscussionStatus(currentModalDisc.status) === 'discussed') && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-emerald-900">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <div>
                        <span className="font-black block">اعتماد النتيجة النهائية ومنح النقاط</span>
                        <span className="text-[11px] text-emerald-700">
                          لن تضاف النقاط للطالب إلا بعد الضغط على اعتماد النتيجة (تضاف مرة واحدة فقط).
                        </span>
                      </div>
                    </div>

                    {canApprove ? (
                      <div className="flex items-center gap-2">
                        <label className="font-bold text-emerald-900">النقاط:</label>
                        <input
                          type="number"
                          min={0}
                          value={customPointsInput}
                          onChange={(e) => setCustomPointsInput(Math.max(0, Number(e.target.value) || 0))}
                          className="w-20 px-2.5 py-1.5 rounded-xl border border-emerald-300 font-black text-center bg-white"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Award className="w-4 h-4" />}
                          onClick={handleApproveOnly}
                        >
                          اعتماد وإضافة النقاط
                        </Button>
                      </div>
                    ) : (
                      <span className="px-3 py-1 rounded-xl bg-white border border-amber-300 text-amber-800 font-bold text-[11px]">
                        صلاحية الاعتماد النهائي محصورة بالمدير العام حسب إعدادات الإدارة
                      </span>
                    )}
                  </div>
                )}

                {/* 5. طلب إعادة مناقشة / إلغاء + السجل التاريخي */}
                {!isApproved && !isCancelled && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <label className="font-bold text-slate-700 block">
                      سبب طلب إعادة المناقشة أو الإلغاء (يُحفظ في السجل التاريخي):
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={actionReasonInput}
                        onChange={(e) => setActionReasonInput(e.target.value)}
                        placeholder="اكتب السبب هنا في حال طلب الإعادة أو الإلغاء..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      />
                      <Button
                        variant="gold"
                        size="sm"
                        icon={<RotateCw className="w-3.5 h-3.5" />}
                        onClick={handleRequestRediscuss}
                      >
                        طلب إعادة مناقشة
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<XCircle className="w-3.5 h-3.5" />}
                        onClick={handleCancelDiscussion}
                      >
                        إلغاء الطلب
                      </Button>
                    </div>
                  </div>
                )}

                {currentModalDisc.history && currentModalDisc.history.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-black text-slate-700">السجل التاريخي للمناقشة (محفوظ وغير قابل للحذف)</h4>
                    <div className="space-y-1.5">
                      {currentModalDisc.history.map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] bg-white px-3 py-2 rounded-xl border border-slate-100">
                          <div>
                            <strong className="text-slate-800">{getDiscussionStatusMeta(h.status).label}</strong>
                            <span className="text-slate-500 mr-2">بواسطة {h.staffName}</span>
                            {(h.notes || h.reason) && (
                              <span className="block text-slate-500">{h.reason || h.notes}</span>
                            )}
                          </div>
                          <span className="text-slate-400 font-mono">{formatArabicDateTime(h.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Modal: إنشاء مناقشة جماعية */}
      {createGroupOpen && (
        <Modal
          isOpen={createGroupOpen}
          onClose={() => setCreateGroupOpen(false)}
          title="إنشاء جلسة مناقشة جماعية"
          subtitle="اختر كتاباً ومجموعة من الطلاب — سيتم تقييم كل طالب ومنحه درجته ونقاطه بشكل مستقل تماماً"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">عنوان جلسة المناقشة: *</label>
                <input
                  type="text"
                  required
                  value={groupTitleInput}
                  onChange={(e) => setGroupTitleInput(e.target.value)}
                  placeholder="مثال: حلقة نقاش قصص الأنبياء"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">الكتاب المستهدف: *</label>
                <select
                  value={groupBookIdInput}
                  onChange={(e) => setGroupBookIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">موعد الجلسة (اختياري):</label>
                <input
                  type="date"
                  value={groupScheduledDate}
                  onChange={(e) => setGroupScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">ملاحظة الموعد:</label>
                <input
                  type="text"
                  value={groupScheduledNote}
                  onChange={(e) => setGroupScheduledNote(e.target.value)}
                  placeholder="القاعة / وقت النشاط"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700 block">
                اختر الطلاب المشاركين (الحد الأقصى {discussionSettings.maxGroupSize || 8}):
              </label>
              <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-200">
                {visibleStudents.map((stu) => {
                  const hasBorrowedBook = loans.some((l) => {
                    if (l.studentId !== stu.id) return false;
                    const cp = copies.find((c) => c.id === l.copyId);
                    return cp?.bookId === groupBookIdInput;
                  });
                  const checked = groupStudentIds.includes(stu.id);
                  return (
                    <label
                      key={stu.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer ${
                        checked ? 'bg-wathba-50 border-wathba-500' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900">{stu.fullName}</div>
                        <div className="text-[10px] text-slate-500">
                          {stu.groupName} {hasBorrowedBook ? '• استعار هذا الكتاب ✅' : ''}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setGroupStudentIds((prev) =>
                            prev.includes(stu.id)
                              ? prev.filter((id) => id !== stu.id)
                              : prev.length < (discussionSettings.maxGroupSize || 8)
                              ? [...prev, stu.id]
                              : prev
                          );
                        }}
                        className="rounded text-wathba-600"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setCreateGroupOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" size="sm" icon={<Users className="w-4 h-4" />}>
                إنشاء الجلسة الجماعية ({groupStudentIds.length} طلاب)
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: إدارة أعضاء المناقشة الجماعية وتقييم كل طالب بشكل مستقل */}
      {activeGroupModal && (
        <Modal
          isOpen={!!activeGroupModal}
          onClose={() => setActiveGroupModal(null)}
          title={`تقييم أعضاء: ${activeGroupModal.title}`}
          subtitle="اختر أي طالب لتسجيل تقييمه الفردي ودرجته ونقاطه بشكل مستقل عن بقية المجموعة"
          maxWidth="2xl"
        >
          <div className="space-y-3">
            {discussions
              .filter((d) => d.groupId === activeGroupModal.id)
              .map((d) => {
                const stu = students.find((s) => s.id === d.studentId);
                const statusMeta = getDiscussionStatusMeta(d.status);
                return (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-black text-slate-900">{stu?.fullName || '-'}</div>
                      <div className="text-[11px] text-slate-500">
                        {stu?.groupName} • الحالة: {statusMeta.label}
                        {d.evaluation.length > 0 && (
                          <span className="font-bold text-wathba-800 mr-2">
                            • الدرجة: {d.totalScore}/{d.maxScore || 100}
                          </span>
                        )}
                        {d.status === 'approved' && (
                          <span className="font-bold text-emerald-700 mr-2">
                            (+{d.pointsAwarded} نقطة)
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={d.status === 'approved' ? 'secondary' : 'primary'}
                      onClick={() => {
                        setActiveGroupModal(null);
                        setSelectedDisc(d);
                      }}
                    >
                      {d.status === 'approved' ? 'عرض التقييم المعتمد' : 'تقييم / اعتماد الطالب'}
                    </Button>
                  </div>
                );
              })}
          </div>
        </Modal>
      )}
    </div>
  );
};
