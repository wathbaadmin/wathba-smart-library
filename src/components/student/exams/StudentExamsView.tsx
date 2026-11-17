import React, { useState, useMemo } from 'react';
import { ElectronicExam, ExamAttempt } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { Button } from '../../common/Button';
import { StudentExamRunnerModal } from './StudentExamRunnerModal';
import {
  getComputedExamStatus,
  isStudentTargeted,
  getRemainingAttempts,
} from '../../../lib/examUtils';
import { formatArabicDateTime } from '../../../lib/dateUtils';
import {
  FileQuestion,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Trophy,
  Award,
  Eye,
  BookOpen,
  Calendar,
  Sparkles,
  Lock,
  X,
} from 'lucide-react';

export const StudentExamsView: React.FC = () => {
  const { currentStudent } = useAuth();
  const { exams, examAttempts } = useLibrary();

  const [activeTab, setActiveTab] = useState<
    'available' | 'upcoming' | 'in_progress' | 'completed' | 'results'
  >('available');

  // Exam runner modal state
  const [runnerModalOpen, setRunnerModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ElectronicExam | null>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttempt | null>(null);

  // Result details modal state
  const [resultModalAttempt, setResultModalAttempt] = useState<ExamAttempt | null>(null);

  // الاختبارات الموجهة للطالب الحالي
  const myTargetedExams = useMemo(() => {
    if (!currentStudent) return [];
    return exams.filter((e) =>
      isStudentTargeted(e, currentStudent.id, currentStudent.groupName)
    );
  }, [exams, currentStudent]);

  // محاولات الطالب الحالي
  const myAttempts = useMemo(() => {
    if (!currentStudent) return [];
    return examAttempts.filter(
      (a) => a.studentId === currentStudent.id && a.status !== 'cancelled'
    );
  }, [examAttempts, currentStudent]);

  // تصنيف الاختبارات حسب التبويبات
  const categorized = useMemo(() => {
    const available: ElectronicExam[] = [];
    const upcoming: ElectronicExam[] = [];
    const inProgress: ElectronicExam[] = [];
    const completed: ElectronicExam[] = [];

    myTargetedExams.forEach((ex) => {
      const status = getComputedExamStatus(ex);
      if (status === 'draft' || status === 'archived') return;

      const attemptsForThisExam = myAttempts.filter((a) => a.examId === ex.id);
      const hasInProgress = attemptsForThisExam.some((a) => a.status === 'in_progress');
      const hasCompleted = attemptsForThisExam.some(
        (a) => a.status === 'graded' || a.status === 'grading_pending'
      );
      const { isExhausted } = getRemainingAttempts(ex, attemptsForThisExam);

      if (hasInProgress) {
        inProgress.push(ex);
      } else if (hasCompleted && isExhausted) {
        completed.push(ex);
      } else if (status === 'published' && !isExhausted) {
        available.push(ex);
      } else if (status === 'scheduled') {
        upcoming.push(ex);
      } else {
        completed.push(ex);
      }
    });

    return { available, upcoming, inProgress, completed };
  }, [myTargetedExams, myAttempts]);

  // فتح أداة حل الاختبار
  const handleOpenRunner = (exam: ElectronicExam) => {
    const existing = myAttempts.find(
      (a) => a.examId === exam.id && a.status === 'in_progress'
    );
    setSelectedExam(exam);
    setSelectedAttempt(existing || null);
    setRunnerModalOpen(true);
  };

  if (!currentStudent) return null;

  return (
    <div className="space-y-6">
      {/* Header Strip */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>بوابة الاختبارات والنماذج الذكية</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">اختباراتي ونماذجي</h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
            اختبر فهمك القرائي، أجب على نماذج المشرفين، وتابع نتائجك وتقييماتك فور اعتمادها.
          </p>
        </div>

        {/* إحصاءات الطالب في الاختبارات */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shrink-0">
          <div className="text-center px-3">
            <span className="text-[10px] text-slate-400 font-bold block">متاحة الآن</span>
            <span className="text-lg font-black text-teal-800">{categorized.available.length}</span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div className="text-center px-3">
            <span className="text-[10px] text-slate-400 font-bold block">أكملتها</span>
            <span className="text-lg font-black text-emerald-700">
              {myAttempts.filter((a) => a.status === 'graded').length}
            </span>
          </div>
        </div>
      </div>

      {/* شريط تبويبات التصفية */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('available')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'available'
              ? 'bg-[#142e38] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>متاحة الآن ({categorized.available.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'upcoming'
              ? 'bg-[#142e38] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>قادمة ومجدولة ({categorized.upcoming.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('in_progress')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'in_progress'
              ? 'bg-[#142e38] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>جارية لم تكتمل ({categorized.inProgress.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'completed'
              ? 'bg-[#142e38] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>مكتملة ({categorized.completed.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'results'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-teal-700 hover:bg-teal-50'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>سجل نتائجي ({myAttempts.length})</span>
        </button>
      </div>

      {/* قائمة بطاقات الاختبارات */}
      {activeTab !== 'results' ? (
        (() => {
          const list =
            activeTab === 'available'
              ? categorized.available
              : activeTab === 'upcoming'
              ? categorized.upcoming
              : activeTab === 'in_progress'
              ? categorized.inProgress
              : categorized.completed;

          if (list.length === 0) {
            return (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-soft">
                <FileQuestion className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-sm font-black text-slate-800">لا توجد اختبارات في هذا القسم</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  ستظهر هنا أي اختبارات جديدة يكلفك بها مشرف المكتبة أو مجموعتك.
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {list.map((exam) => {
                const status = getComputedExamStatus(exam);
                const attemptsForThisExam = myAttempts.filter((a) => a.examId === exam.id);
                const { remaining, totalAllowed, isExhausted } = getRemainingAttempts(
                  exam,
                  attemptsForThisExam
                );
                const hasInProgress = attemptsForThisExam.some((a) => a.status === 'in_progress');
                const lastAttempt = attemptsForThisExam[attemptsForThisExam.length - 1];

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 shadow-card hover:shadow-lg transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
                          {exam.subject}
                        </span>

                        <span className="text-[10px] font-bold text-slate-500">
                          بإشراف: {exam.supervisorName}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-black text-slate-900 line-clamp-2">
                          {exam.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {exam.instructions}
                        </p>
                      </div>

                      {/* التفاصيل السريعة */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">المدة</span>
                          <span className="font-black text-slate-800">{exam.durationMinutes} د</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">الأسئلة</span>
                          <span className="font-black text-slate-800">{exam.questions?.length || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">الدرجة</span>
                          <span className="font-black text-teal-800">{exam.totalPoints} ن</span>
                        </div>
                      </div>

                      {/* المحاولات المتبقية */}
                      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                        <span>المحاولات المتبقية:</span>
                        <span className="font-bold text-slate-800">
                          {totalAllowed === 0 ? 'غير محدودة' : `${remaining} من ${totalAllowed}`}
                        </span>
                      </div>
                    </div>

                    {/* زر الإجراء */}
                    <div className="pt-3 border-t border-slate-100">
                      {hasInProgress ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          icon={<RotateCcw className="w-4 h-4" />}
                          onClick={() => handleOpenRunner(exam)}
                          className="w-full bg-amber-600 hover:bg-amber-700 font-black shadow-md"
                        >
                          استئناف حل الاختبار
                        </Button>
                      ) : isExhausted ? (
                        <div className="flex items-center gap-2">
                          {lastAttempt && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="md"
                              icon={<Eye className="w-4 h-4" />}
                              onClick={() => setResultModalAttempt(lastAttempt)}
                              className="w-full text-xs font-bold"
                            >
                              عرض نتيجتي ({lastAttempt.totalScore}/{lastAttempt.maxPossibleScore})
                            </Button>
                          )}
                        </div>
                      ) : status === 'published' ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          icon={<Play className="w-4 h-4" />}
                          onClick={() => handleOpenRunner(exam)}
                          className="w-full bg-[#142e38] text-white font-black shadow-md hover:bg-[#1f4553]"
                        >
                          بدء الاختبار الآن
                        </Button>
                      ) : (
                        <div className="p-2.5 rounded-2xl bg-slate-100 text-slate-500 text-xs font-bold text-center">
                          يبدأ في: {formatArabicDateTime(exam.startsAt)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      ) : (
        /* ================= تبويب سجل النتائج ================= */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden space-y-4 p-5 sm:p-6">
          <h3 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-3">
            سجل محاولاتي ودرجاتي في الاختبارات ({myAttempts.length})
          </h3>

          {myAttempts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              لم تسجل أي محاولة حتى الآن. اختر اختباراً من قائمة "المتاحة الآن" وابدأ باختبار معلوماتك.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myAttempts.map((att) => (
                <div
                  key={att.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md">
                      المحاولة #{att.attemptNumber}
                    </span>
                    <h4 className="text-sm font-black text-slate-900">{att.examTitleSnapshot}</h4>
                    <span className="text-[11px] text-slate-400 block">
                      وقت التسليم: {att.submittedAt ? formatArabicDateTime(att.submittedAt) : 'لم يسلم'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center sm:text-left">
                      <div className="text-xl font-black text-slate-900">
                        {att.totalScore}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          من {att.maxPossibleScore} ({att.percentage}%)
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          att.isPassed
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-rose-50 text-rose-800'
                        }`}
                      >
                        {att.isPassed ? 'اجتياز بنجاح 🏆' : 'لم يجتز'}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => setResultModalAttempt(att)}
                      className="text-xs font-bold shrink-0"
                    >
                      التفاصيل والإفادة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* نافذة حل الاختبار التفاعلية */}
      {selectedExam && (
        <StudentExamRunnerModal
          isOpen={runnerModalOpen}
          onClose={() => {
            setRunnerModalOpen(false);
            setSelectedExam(null);
            setSelectedAttempt(null);
          }}
          exam={selectedExam}
          existingAttempt={selectedAttempt}
        />
      )}

      {/* نافذة استعراض النتيجة والتغذية الراجعة */}
      {resultModalAttempt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  تفاصيل نتيجة: {resultModalAttempt.examTitleSnapshot}
                </h3>
                <span className="text-xs text-slate-500">
                  المحاولة #{resultModalAttempt.attemptNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setResultModalAttempt(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* بطاقة الدرجة */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <span className="text-xs font-bold text-slate-400 block">درجتك النهائية:</span>
                <div className="text-3xl font-black text-slate-900">
                  {resultModalAttempt.totalScore} / {resultModalAttempt.maxPossibleScore}{' '}
                  <span className="text-sm text-teal-700">({resultModalAttempt.percentage}%)</span>
                </div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                    resultModalAttempt.isPassed
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {resultModalAttempt.isPassed ? 'تم الاجتياز بنجاح 🎓' : 'لم يتم الاجتياز'}
                </span>
              </div>

              {/* ملاحظات المشرف إن وجدت */}
              {resultModalAttempt.supervisorFeedback && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                  <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>إفادة وملاحظات المشرف:</span>
                  </span>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    {resultModalAttempt.supervisorFeedback}
                  </p>
                </div>
              )}

              {/* استعراض الإجابات والتفسيرات إذا سمح المشرف */}
              {resultModalAttempt.examSnapshot?.settings?.showCorrectAnswers !== 'never' && (
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-black text-slate-700">مراجعة الأسئلة وتفسير الإجابات:</h4>
                  {(resultModalAttempt.examSnapshot?.questions || []).map((q, idx) => {
                    const ans = resultModalAttempt.answers[q.id];
                    const pts = ans?.awardedPoints ?? 0;

                    return (
                      <div
                        key={q.id}
                        className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900">
                            {idx + 1}. {q.title}
                          </span>
                          <span className="font-bold text-teal-800">
                            {pts} / {q.points} ن
                          </span>
                        </div>

                        {q.explanation && (
                          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 leading-relaxed">
                            <span className="font-bold">التفسير: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
