import React, { useState, useMemo } from 'react';
import { ElectronicExam, ExamStatus } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import { Button } from '../../common/Button';
import { ExamEditorModal } from './ExamEditorModal';
import { ExamResultsAndGradingModal } from './ExamResultsAndGradingModal';
import { formatArabicDateTime } from '../../../lib/dateUtils';
import { getComputedExamStatus } from '../../../lib/examUtils';
import {
  FileQuestion,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Edit3,
  Trash2,
  Trophy,
  Play,
  Pause,
  Send,
  MoreVertical,
  Users,
  Award,
  Sparkles,
} from 'lucide-react';

export const ExamsManagementView: React.FC = () => {
  const { currentStaff } = useAuth();
  const {
    exams,
    examAttempts,
    publishExam,
    pauseExam,
    extendExamDuration,
    duplicateExam,
    deleteExam,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [activeFilterTab, setActiveFilterTab] = useState<
    'all' | 'published' | 'scheduled' | 'closed' | 'draft' | 'archived'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<ElectronicExam | null>(null);

  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [examForResults, setExamForResults] = useState<ElectronicExam | null>(null);

  const isAdmin = currentStaff?.role === 'admin';
  const supervisorName = currentStaff?.fullName || 'المشرف';
  const supervisorId = currentStaff?.id || 'staff-1';

  // تصفية الاختبارات حسب صلاحية المشرف (المشرف يرى اختباراته + الاختبارات الموجهة لطلابه)
  const accessibleExams = useMemo(() => {
    if (isAdmin) return exams;
    return exams.filter(
      (e) =>
        e.supervisorId === supervisorId ||
        (currentStaff?.assignedGroups &&
          e.targetGroupNames?.some((grp) => currentStaff.assignedGroups?.includes(grp)))
    );
  }, [exams, isAdmin, supervisorId, currentStaff]);

  // إحصائيات عامة
  const metrics = useMemo(() => {
    const total = accessibleExams.length;
    const published = accessibleExams.filter((e) => getComputedExamStatus(e) === 'published').length;
    const scheduled = accessibleExams.filter((e) => getComputedExamStatus(e) === 'scheduled').length;
    const drafts = accessibleExams.filter((e) => e.status === 'draft').length;
    const closed = accessibleExams.filter((e) => getComputedExamStatus(e) === 'closed').length;

    const allAttempts = examAttempts.filter((a) =>
      accessibleExams.some((e) => e.id === a.examId)
    );
    const completedAttempts = allAttempts.filter(
      (a) => a.status === 'graded' || a.status === 'grading_pending'
    );
    const passCount = completedAttempts.filter((a) => a.isPassed).length;
    const overallPassRate =
      completedAttempts.length > 0
        ? Math.round((passCount / completedAttempts.length) * 100)
        : 0;

    return {
      total,
      published,
      scheduled,
      drafts,
      closed,
      attemptsCount: allAttempts.length,
      overallPassRate,
    };
  }, [accessibleExams, examAttempts]);

  // تصفية القائمة المعروضة
  const filteredExams = useMemo(() => {
    return accessibleExams.filter((e) => {
      const computed = getComputedExamStatus(e);

      // فلترة التبويب
      if (activeFilterTab !== 'all') {
        if (activeFilterTab === 'draft' && e.status !== 'draft') return false;
        if (activeFilterTab === 'archived' && e.status !== 'archived') return false;
        if (activeFilterTab === 'published' && computed !== 'published') return false;
        if (activeFilterTab === 'scheduled' && computed !== 'scheduled') return false;
        if (activeFilterTab === 'closed' && computed !== 'closed') return false;
      }

      // فلترة البحث
      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;
      return (
        e.title.toLowerCase().includes(term) ||
        e.subject.toLowerCase().includes(term) ||
        e.supervisorName.toLowerCase().includes(term) ||
        e.code.toLowerCase().includes(term)
      );
    });
  }, [accessibleExams, activeFilterTab, searchTerm]);

  // التعامل مع العمليات السريعة
  const handlePublish = (examId: string) => {
    const res = publishExam(examId);
    if (res.success) {
      showToast('تم نشر الاختبار للطلاب بنجاح! 🚀', 'success');
    } else {
      showToast(res.error || 'تعذر نشر الاختبار', 'error');
    }
  };

  const handleTogglePause = (exam: ElectronicExam) => {
    const nextPaused = !exam.settings?.isPaused;
    pauseExam(exam.id, nextPaused);
    showToast(
      nextPaused ? 'تم إيقاف استقبال الإجابات مؤقتاً.' : 'تم استئناف استقبال الإجابات بنجاح.',
      'info'
    );
  };

  const handleDuplicate = (examId: string) => {
    const res = duplicateExam(examId);
    if (res.success) {
      showToast('تم إنشاء نسخة جديدة من الاختبار كمسودة! 📋', 'success');
    }
  };

  const handleDelete = (examId: string, title: string) => {
    if (window.confirm(`هل أنت متأكد من رغبتك في حذف أو أرشفة اختبار "${title}"؟`)) {
      deleteExam(examId);
      showToast('تم حذف/أرشفة الاختبار بنجاح.', 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>نظام الاختبارات الإلكترونية المدمج • مكتبة مداد</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            إدارة الاختبارات والنماذج الإلكترونية
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            أنشئ اختبارات ونماذج ذكية مدعومة بالتصحيح التلقائي، رصد الدرجات، واستعراض الإحصائيات الميدانية دون مغادرة الموقع.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={<Plus className="w-5 h-5" />}
            onClick={() => {
              setExamToEdit(null);
              setIsEditorOpen(true);
            }}
            className="bg-[#142e38] text-white font-black shadow-md hover:bg-[#1d4250]"
          >
            إنشاء اختبار جديد
          </Button>
        </div>
      </div>

      {/* شريط بطاقات الإحصاءات */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">إجمالي الاختبارات</span>
          <span className="text-2xl font-black text-slate-900 block">{metrics.total}</span>
          <span className="text-[10px] text-teal-700 font-bold">منها {metrics.published} نشط الآن</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">إجمالي المحاولات</span>
          <span className="text-2xl font-black text-slate-900 block">{metrics.attemptsCount}</span>
          <span className="text-[10px] text-slate-400">محاولات الطلاب المسجلة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">نسبة النجاح العامة</span>
          <span className="text-2xl font-black text-emerald-700 block">{metrics.overallPassRate}%</span>
          <span className="text-[10px] text-slate-400">في كافة الاختبارات</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500">مسودات قيد الإعداد</span>
          <span className="text-2xl font-black text-amber-700 block">{metrics.drafts}</span>
          <span className="text-[10px] text-slate-400">بانتظار الاكتمال والنشر</span>
        </div>
      </div>

      {/* شريط التبويبات والبحث */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setActiveFilterTab('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              activeFilterTab === 'all'
                ? 'bg-[#142e38] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            الكل ({metrics.total})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('published')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              activeFilterTab === 'published'
                ? 'bg-[#142e38] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            المنشورة ({metrics.published})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('scheduled')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              activeFilterTab === 'scheduled'
                ? 'bg-[#142e38] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            المجدولة ({metrics.scheduled})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('draft')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              activeFilterTab === 'draft'
                ? 'bg-[#142e38] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            المسودات ({metrics.drafts})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilterTab('closed')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
              activeFilterTab === 'closed'
                ? 'bg-[#142e38] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            المنتهية ({metrics.closed})
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالعنوان، المادة، أو الرمز..."
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs font-bold focus:ring-1 focus:ring-teal-700 focus:outline-none"
          />
        </div>
      </div>

      {/* قائمة بطاقات الاختبارات */}
      {filteredExams.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-soft">
          <FileQuestion className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-black text-slate-800">لا توجد اختبارات في هذا القسم</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            يمكنك إنشاء اختبار إلكتروني جديد وتخصيص أسئلته وإعداده للطلاب بكل سهولة.
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setExamToEdit(null);
              setIsEditorOpen(true);
            }}
          >
            إنشاء أول اختبار
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const status = getComputedExamStatus(exam);
            const attemptsCount = examAttempts.filter((a) => a.examId === exam.id).length;
            const isPaused = Boolean(exam.settings?.isPaused);

            return (
              <div
                key={exam.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-card hover:shadow-lg transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  {/* شريط الحالة والرمز */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {exam.code}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isPaused ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-800 border border-rose-200">
                          موقوف مؤقتاً
                        </span>
                      ) : status === 'published' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                          منشور • نشط
                        </span>
                      ) : status === 'scheduled' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                          مجدول
                        </span>
                      ) : status === 'draft' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                          مسودة
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">
                          منتهي
                        </span>
                      )}
                    </div>
                  </div>

                  {/* عنوان الاختبار والموضوع */}
                  <div className="space-y-1">
                    <h3 className="font-black text-base text-slate-900 group-hover:text-teal-900 transition-colors line-clamp-2">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{exam.instructions}</p>
                  </div>

                  {/* تفاصيل المادة والمشرف والمستهدفين */}
                  <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">الموضوع:</span>
                      <span className="font-bold text-slate-800 truncate">{exam.subject}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">المشرف:</span>
                      <span className="font-bold text-slate-800 truncate">{exam.supervisorName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {exam.targetAudienceType === 'all'
                          ? 'جميع طلاب المكتبة'
                          : exam.targetAudienceType === 'group'
                          ? `المجموعات: ${(exam.targetGroupNames || []).join('، ')}`
                          : 'طلاب محددين'}
                      </span>
                    </div>
                  </div>

                  {/* إحصائيات سريعة للبطاقة */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">الأسئلة</span>
                      <span className="font-black text-slate-800">{exam.questions?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">الدرجة</span>
                      <span className="font-black text-teal-800">{exam.totalPoints} ن</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">المدة</span>
                      <span className="font-black text-slate-800">{exam.durationMinutes} د</span>
                    </div>
                  </div>
                </div>

                {/* أزرار الإجراءات */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      icon={<Trophy className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setExamForResults(exam);
                        setIsResultsOpen(true);
                      }}
                      className="bg-teal-700 hover:bg-teal-800 text-xs font-black shadow-xs"
                    >
                      النتائج ({attemptsCount})
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Edit3 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setExamToEdit(exam);
                        setIsEditorOpen(true);
                      }}
                      className="text-xs font-bold"
                    >
                      تعديل
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    {exam.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => handlePublish(exam.id)}
                        title="نشر الاختبار الآن"
                        className="p-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTogglePause(exam)}
                        title={isPaused ? 'استئناف استقبال الإجابات' : 'إيقاف استقبال الإجابات مؤقتاً'}
                        className={`p-2 rounded-xl transition-colors ${
                          isPaused
                            ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDuplicate(exam.id)}
                      title="نسخ الاختبار كمسودة جديدة"
                      className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(exam.id, exam.title)}
                      title="حذف / أرشفة"
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة محرر الأسئلة */}
      <ExamEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setExamToEdit(null);
        }}
        examToEdit={examToEdit}
        defaultSupervisorName={supervisorName}
        defaultSupervisorId={supervisorId}
      />

      {/* نافذة النتائج والتصحيح */}
      {examForResults && (
        <ExamResultsAndGradingModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            setExamForResults(null);
          }}
          exam={examForResults}
        />
      )}
    </div>
  );
};
