import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ElectronicExam, ExamAttempt, ExamQuestion, StudentQuestionAnswer } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import { Button } from '../../common/Button';
import { prepareStudentExamQuestions, formatRemainingTime } from '../../../lib/examUtils';
import {
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Image as ImageIcon,
  HelpCircle,
  Trophy,
  Check,
  ShieldCheck,
  Sparkles,
  Lock,
} from 'lucide-react';

interface StudentExamRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ElectronicExam;
  existingAttempt?: ExamAttempt | null;
  onAttemptCompleted?: (attempt: ExamAttempt) => void;
}

export const StudentExamRunnerModal: React.FC<StudentExamRunnerModalProps> = ({
  isOpen,
  onClose,
  exam,
  existingAttempt,
  onAttemptCompleted,
}) => {
  const { currentStudent } = useAuth();
  const {
    startExamAttempt,
    saveExamAttemptProgress,
    submitExamAttempt,
  } = useLibrary();
  const { showToast } = useNotifications();

  // حالة مرحلة الاختبار: 'briefing' (الترحيب والتعليمات) | 'running' (جاري الحل) | 'submitted' (تم التسليم)
  const [phase, setPhase] = useState<'briefing' | 'running' | 'submitted'>(
    existingAttempt?.status === 'in_progress' ? 'running' : 'briefing'
  );

  const [currentAttempt, setCurrentAttempt] = useState<ExamAttempt | null>(existingAttempt || null);

  // إعداد الأسئلة (خلط عشوائي إذا كان مفعلاً)
  const preparedQuestions = useMemo<ExamQuestion[]>(() => {
    if (existingAttempt?.examSnapshot?.questions) {
      return existingAttempt.examSnapshot.questions;
    }
    return prepareStudentExamQuestions(exam);
  }, [exam, existingAttempt]);

  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // إجابات الطالب الحالية
  const [userAnswers, setUserAnswers] = useState<Record<string, StudentQuestionAnswer>>(
    existingAttempt?.answers || {}
  );

  // مؤقت العد التنازلي للوقت المتبقي بالثواني
  const totalDurationSeconds = (exam.durationMinutes || 20) * 60;
  const [remainingSeconds, setRemainingSeconds] = useState<number>(totalDurationSeconds);

  // نافذة تأكيد التسليم
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedAttemptResult, setCompletedAttemptResult] = useState<ExamAttempt | null>(null);

  // مزامنة الوقت المستغرق إذا كان هناك محاولة سابقة جارية
  useEffect(() => {
    if (phase === 'running' && currentAttempt?.startedAt) {
      const startMs = new Date(currentAttempt.startedAt).getTime();
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - startMs) / 1000);
      const left = Math.max(0, totalDurationSeconds - elapsedSec);
      setRemainingSeconds(left);
    }
  }, [phase, currentAttempt, totalDurationSeconds]);

  // تشغيل العداد التنازلي
  useEffect(() => {
    if (phase !== 'running' || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // تسليم تلقائي فور انتهاء الوقت!
          handleAutoSubmitOnTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, remainingSeconds]);

  // حفظ التقدم دورياً في الخلفية
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const saveProgress = (nextAnswers: Record<string, StudentQuestionAnswer>) => {
    setUserAnswers(nextAnswers);
    if (currentAttempt) {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        saveExamAttemptProgress(currentAttempt.id, nextAnswers);
      }, 500);
    }
  };

  if (!isOpen) return null;

  // بدء الاختبار
  const handleStartExam = () => {
    if (!currentStudent) return;
    const res = startExamAttempt(exam.id, currentStudent.id);
    if (res.success && res.attempt) {
      setCurrentAttempt(res.attempt);
      setUserAnswers(res.attempt.answers || {});
      setPhase('running');
    } else {
      showToast(res.error || 'تعذر بدء الاختبار', 'error');
    }
  };

  // تسليم تلقائي عند نفاد الوقت
  const handleAutoSubmitOnTimeOut = () => {
    showToast('انتهى وقت الاختبار! جاري حفظ الإجابات وتسليم المحاولة تلقائياً...', 'warning');
    handleFinalSubmit();
  };

  // معالجة اختيار إجابة لسؤال محدد
  const handleAnswerChange = (qId: string, patch: Partial<StudentQuestionAnswer>) => {
    const existing = userAnswers[qId] || { questionId: qId, awardedPoints: 0, isManuallyGraded: false };
    const updated = {
      ...userAnswers,
      [qId]: { ...existing, ...patch },
    };
    saveProgress(updated);
  };

  // فحص الأسئلة المجابة
  const answeredCount = preparedQuestions.filter((q) => {
    const ans = userAnswers[q.id];
    if (!ans) return false;
    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      return Boolean(ans.selectedOptionIds && ans.selectedOptionIds.length > 0);
    }
    if (q.type === 'checkboxes') {
      return Boolean(ans.selectedOptionIds && ans.selectedOptionIds.length > 0);
    }
    if (q.type === 'true_false') {
      return ans.selectedBoolean !== undefined;
    }
    if (q.type === 'numeric') {
      return ans.numericAnswer !== undefined && !isNaN(ans.numericAnswer);
    }
    return Boolean(ans.textAnswer && ans.textAnswer.trim().length > 0);
  }).length;

  const currentQ = preparedQuestions[activeQuestionIdx];
  const isSinglePage = exam.settings?.paginationMode === 'single';

  // تسليم الإجابات النهائي
  const handleFinalSubmit = () => {
    if (!currentAttempt) return;
    setIsSubmitting(true);

    try {
      const res = submitExamAttempt(currentAttempt.id, userAnswers);
      if (res.success && res.attempt) {
        setCompletedAttemptResult(res.attempt);
        setPhase('submitted');
        setShowConfirmSubmit(false);
        if (onAttemptCompleted) {
          onAttemptCompleted(res.attempt);
        }
        showToast('تم تسليم الاختبار بنجاح! بارك الله في جهودك. 🎓', 'success');
      } else {
        showToast(res.error || 'تعذر تسليم الاختبار', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#f8fafc] w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] my-auto">
        {/* =========================================================================
            المرحلة 1: بطاقة الترحيب والتعليمات (Briefing)
            ========================================================================= */}
        {phase === 'briefing' && (
          <div className="p-6 sm:p-10 space-y-6 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center mx-auto shadow-sm">
              <BookOpen className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-900">
                {exam.subject}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">{exam.title}</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
                {exam.instructions || 'أهلاً بك يا بطل! استعن بالله واقرأ كل سؤال بعناية.'}
              </p>
            </div>

            {/* تفاصيل الاختبار الأساسية */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-white border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 block">مدة الاختبار</span>
                <span className="text-base font-black text-slate-900">{exam.durationMinutes} دقيقة</span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 block">عدد الأسئلة</span>
                <span className="text-base font-black text-slate-900">{preparedQuestions.length} أسئلة</span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 block">الدرجة الكلية</span>
                <span className="text-base font-black text-teal-800">{exam.totalPoints} درجة</span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 block">درجة النجاح</span>
                <span className="text-base font-black text-emerald-700">{exam.passingScore} درجة</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-right space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>إرشادات قبل البدء:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                • سيبدأ احتساب الوقت فور الضغط على زر "بدء الاختبار".
                <br />
                • يتم حفظ إجاباتك تلقائياً عند الانتقال بين الأسئلة.
                <br />
                • عند نفاد الوقت سيتم إرسال إجاباتك المسجلة تلقائياً دون فقدان.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button type="button" variant="secondary" size="lg" onClick={onClose}>
                إلغاء والعودة
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                icon={<Sparkles className="w-5 h-5" />}
                onClick={handleStartExam}
                className="bg-[#142e38] text-white font-black px-8 shadow-lg hover:bg-[#1f4553]"
              >
                بدء الاختبار الآن
              </Button>
            </div>
          </div>
        )}

        {/* =========================================================================
            المرحلة 2: واجهة حل الاختبار (Running Exam Engine)
            ========================================================================= */}
        {phase === 'running' && (
          <>
            {/* الشريط العلوي الثابت مع العداد التنازلي ومؤشر التقدم */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 truncate">{exam.title}</h3>
                <span className="text-[11px] text-slate-500">
                  تمت الإجابة على <strong>{answeredCount}</strong> من أصل {preparedQuestions.length} سؤال
                </span>
              </div>

              {/* العداد التنازلي التفاعلي */}
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border font-mono font-black text-sm shadow-xs ${
                  remainingSeconds <= 60
                    ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                    : remainingSeconds <= 180
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-teal-50 border-teal-200 text-teal-900'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatRemainingTime(remainingSeconds)}</span>
              </div>
            </div>

            {/* شريط أرقام الأسئلة والتنقل السريع */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center gap-1.5 overflow-x-auto shrink-0">
              {preparedQuestions.map((q, idx) => {
                const isAnswered = Boolean(userAnswers[q.id]);
                const isCurrent = idx === activeQuestionIdx;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      if (!isSinglePage || exam.settings?.allowBackNavigation !== false) {
                        setActiveQuestionIdx(idx);
                      }
                    }}
                    className={`w-8 h-8 rounded-xl text-xs font-black transition-all flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-[#142e38] text-white shadow-sm ring-2 ring-teal-500'
                        : isAnswered
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* منطقة عرض الأسئلة */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* عرض سؤال واحد أو جميع الأسئلة بناءً على الإعدادات */}
              {(isSinglePage ? [currentQ] : preparedQuestions).map((q, qIndex) => {
                const actualIndex = isSinglePage ? activeQuestionIdx : qIndex;
                const userAns = userAnswers[q.id];

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-card space-y-4"
                  >
                    {/* رأس السؤال */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 flex items-center justify-center text-xs font-black">
                          {actualIndex + 1}
                        </span>
                        <h4 className="text-base font-black text-slate-900 leading-snug">{q.title}</h4>
                      </div>
                      <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
                        {q.points} درجات
                      </span>
                    </div>

                    {/* نص الفقرة إن وجد */}
                    {q.passageText && (
                      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs sm:text-sm text-slate-800 leading-relaxed">
                        <span className="font-bold text-amber-900 block mb-1">فقرة القراءة والفهم:</span>
                        {q.passageText}
                      </div>
                    )}

                    {/* صورة توضيحية إن وجدت */}
                    {q.imageUrl && (
                      <div className="text-center py-2">
                        <img
                          src={q.imageUrl}
                          alt="توضيح السؤال"
                          className="max-h-60 rounded-2xl object-contain mx-auto border border-slate-200"
                        />
                      </div>
                    )}

                    {/* خيارات السؤال وفق النوع */}

                    {/* 1. اختيار من متعدد (إجابة واحدة) */}
                    {(q.type === 'multiple_choice' ||
                      q.type === 'dropdown' ||
                      (q.type === 'image_based' && q.options) ||
                      (q.type === 'passage_based' && q.options)) && (
                      <div className="space-y-2 pt-2">
                        {(q.options || []).map((opt) => {
                          const isSelected = userAns?.selectedOptionIds?.includes(opt.id);

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleAnswerChange(q.id, { selectedOptionIds: [opt.id] })}
                              className={`w-full p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 ${
                                isSelected
                                  ? 'bg-teal-50/80 border-teal-600 text-teal-950 font-black shadow-xs ring-1 ring-teal-500'
                                  : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'border-teal-700 bg-teal-700 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <span className="w-2 h-2 bg-white rounded-full" />}
                              </span>
                              <span className="text-xs sm:text-sm">{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 2. مربعات اختيار (أكثر من إجابة) */}
                    {q.type === 'checkboxes' && (
                      <div className="space-y-2 pt-2">
                        <span className="text-[11px] text-slate-400 block">اختر كل الإجابات الصحيحة:</span>
                        {(q.options || []).map((opt) => {
                          const selectedList = userAns?.selectedOptionIds || [];
                          const isSelected = selectedList.includes(opt.id);

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const nextList = isSelected
                                  ? selectedList.filter((id) => id !== opt.id)
                                  : [...selectedList, opt.id];
                                handleAnswerChange(q.id, { selectedOptionIds: nextList });
                              }}
                              className={`w-full p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 ${
                                isSelected
                                  ? 'bg-teal-50/80 border-teal-600 text-teal-950 font-black shadow-xs ring-1 ring-teal-500'
                                  : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'border-teal-700 bg-teal-700 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                              </span>
                              <span className="text-xs sm:text-sm">{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 3. صح أو خطأ */}
                    {q.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(q.id, { selectedBoolean: true })}
                          className={`p-4 rounded-2xl border text-center font-black text-sm transition-all ${
                            userAns?.selectedBoolean === true
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          صح (صواب) ✓
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAnswerChange(q.id, { selectedBoolean: false })}
                          className={`p-4 rounded-2xl border text-center font-black text-sm transition-all ${
                            userAns?.selectedBoolean === false
                              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          خطأ ✕
                        </button>
                      </div>
                    )}

                    {/* 4. سؤال رقمي */}
                    {q.type === 'numeric' && (
                      <div className="pt-2">
                        <input
                          type="number"
                          value={userAns?.numericAnswer ?? ''}
                          onChange={(e) =>
                            handleAnswerChange(q.id, {
                              numericAnswer: e.target.value === '' ? undefined : Number(e.target.value),
                            })
                          }
                          placeholder="اكتب الرقم هنا..."
                          className="w-full max-w-xs px-4 py-3 rounded-2xl border border-slate-300 font-bold text-sm focus:ring-2 focus:ring-teal-700 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* 5. إجابة قصيرة */}
                    {q.type === 'short_answer' && (
                      <div className="pt-2">
                        <input
                          type="text"
                          value={userAns?.textAnswer || ''}
                          onChange={(e) => handleAnswerChange(q.id, { textAnswer: e.target.value })}
                          placeholder="اكتب إجابتك المختصرة هنا..."
                          className="w-full px-4 py-3 rounded-2xl border border-slate-300 font-bold text-sm focus:ring-2 focus:ring-teal-700 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* 6. إجابة طويلة (فقرة) */}
                    {q.type === 'long_answer' && (
                      <div className="pt-2">
                        <textarea
                          rows={4}
                          value={userAns?.textAnswer || ''}
                          onChange={(e) => handleAnswerChange(q.id, { textAnswer: e.target.value })}
                          placeholder="اكتب إجابتك التفصيلية هنا..."
                          className="w-full p-4 rounded-2xl border border-slate-300 font-medium text-xs sm:text-sm leading-relaxed focus:ring-2 focus:ring-teal-700 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* الشريط السفلي للتنقل والتسليم */}
            <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {isSinglePage ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={activeQuestionIdx === 0 || exam.settings?.allowBackNavigation === false}
                    onClick={() => setActiveQuestionIdx((prev) => Math.max(0, prev - 1))}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    السابق
                  </Button>

                  {activeQuestionIdx < preparedQuestions.length - 1 ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={() =>
                        setActiveQuestionIdx((prev) =>
                          Math.min(preparedQuestions.length - 1, prev + 1)
                        )
                      }
                      icon={<ArrowLeft className="w-4 h-4" />}
                      className="bg-[#142e38] font-bold"
                    >
                      التالي
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="text-xs text-slate-500 font-bold">
                  تأكد من الإجابة على جميع الأسئلة قبل الضغط على تسليم
                </div>
              )}

              <Button
                type="button"
                variant="primary"
                size="md"
                icon={<Send className="w-4 h-4" />}
                onClick={() => setShowConfirmSubmit(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-black shadow-md px-6"
              >
                تسليم الاختبار
              </Button>
            </div>
          </>
        )}

        {/* =========================================================================
            المرحلة 3: شاشة نجاح التسليم وإعلان النتيجة (Submitted View)
            ========================================================================= */}
        {phase === 'submitted' && completedAttemptResult && (
          <div className="p-6 sm:p-10 space-y-6 text-center max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">تم استلام إجاباتك بنجاح!</h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                بارك الله في حرصك وتميزك. تم حفظ محاولتك كاملة في سجلات مكتبة مداد.
              </p>
            </div>

            {/* إذا كانت النتائج تظهر فورياً */}
            {completedAttemptResult.status === 'graded' &&
            exam.settings?.resultsReleaseMode === 'immediate' ? (
              <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-soft space-y-3">
                <span className="text-xs font-bold text-slate-400 block">درجتك في الاختبار:</span>
                <div className="text-3xl font-black text-slate-900">
                  {completedAttemptResult.totalScore}{' '}
                  <span className="text-sm font-normal text-slate-500">
                    من {completedAttemptResult.maxPossibleScore} ({completedAttemptResult.percentage}%)
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-block px-4 py-1.5 rounded-full text-xs font-black ${
                      completedAttemptResult.isPassed
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {completedAttemptResult.isPassed ? 'مبارك! لقد اجتزت الاختبار بنجاح 🏆' : 'حاول مرة أخرى في المرات القادمة 👍'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-3xl bg-teal-50 border border-teal-200 text-teal-900 text-xs leading-relaxed">
                يحتوي هذا الاختبار على أسئلة مقالية أو تتطلب اعتماد المشرف. سيتم إعلان نتيجتك النهائية ورصد الدرجة بعد مراجعة المشرف المسؤول.
              </div>
            )}

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onClose}
              className="bg-[#142e38] font-bold px-8 shadow-md"
            >
              العودة إلى لوحة اختباراتي
            </Button>
          </div>
        )}

        {/* نافذة التأكيد قبل التسليم */}
        {showConfirmSubmit && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">تأكيد تسليم الاختبار؟</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  أجبت على <strong>{answeredCount}</strong> من أصل {preparedQuestions.length} سؤال. لن يمكنك تعديل إجاباتك بعد التأكيد والإرسال.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setShowConfirmSubmit(false)}
                >
                  الرجوع للمراجعة
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={isSubmitting}
                  onClick={handleFinalSubmit}
                  className="bg-emerald-700 hover:bg-emerald-800 font-black shadow-md px-6"
                >
                  نعم، تسليم الآن
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
