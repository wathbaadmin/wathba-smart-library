import React, { useState, useMemo } from 'react';
import { ElectronicExam, ExamAttempt } from '../../../types';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import { Button } from '../../common/Button';
import { exportToExcel } from '../../../lib/exportUtils';
import { formatArabicDateTime } from '../../../lib/dateUtils';
import {
  X,
  Trophy,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Search,
  ChevronLeft,
  ChevronRight,
  Award,
  Check,
  HelpCircle,
  Eye,
  Star,
  BookOpen,
} from 'lucide-react';

interface ExamResultsAndGradingModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: ElectronicExam;
}

export const ExamResultsAndGradingModal: React.FC<ExamResultsAndGradingModalProps> = ({
  isOpen,
  onClose,
  exam,
}) => {
  const {
    examAttempts,
    students,
    gradeAttemptQuestion,
    approveAndFinalizeAttempt,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [searchStudent, setSearchStudent] = useState('');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [supervisorFeedbackText, setSupervisorFeedbackText] = useState('');

  // استخراج المحاولات التابعة لهذا الاختبار
  const attempts = useMemo(
    () => examAttempts.filter((a) => a.examId === exam.id && a.status !== 'cancelled'),
    [examAttempts, exam.id]
  );

  // حساب الطلاب المستهدفين
  const targetedStudents = useMemo(() => {
    if (exam.targetAudienceType === 'all') return students;
    if (exam.targetAudienceType === 'group') {
      const grps = new Set(exam.targetGroupNames || []);
      return students.filter((s) => s.groupName && grps.has(s.groupName));
    }
    const targetIds = new Set(exam.targetStudentIds || []);
    return students.filter((s) => targetIds.has(s.id));
  }, [exam, students]);

  // إحصائيات الأداء
  const stats = useMemo(() => {
    const totalTargeted = targetedStudents.length || 1;
    const completed = attempts.filter((a) => a.status === 'graded' || a.status === 'grading_pending');
    const started = attempts.length;
    const completedCount = completed.length;
    const notParticipated = Math.max(0, totalTargeted - started);

    const scores = completed.map((a) => a.totalScore);
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const passedCount = completed.filter((a) => a.isPassed).length;
    const passRate =
      completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

    return {
      totalTargeted,
      started,
      completedCount,
      notParticipated,
      avgScore,
      maxScore,
      minScore,
      passRate,
    };
  }, [targetedStudents, attempts]);

  if (!isOpen) return null;

  // الطالب المختار للمراجعة والتصحيح
  const selectedAttempt = attempts.find((a) => a.id === selectedAttemptId);

  // تصدير النتائج إلى Excel
  const handleExportExcel = () => {
    if (attempts.length === 0) {
      showToast('لا توجد نتائج مسجلة لتصديرها.', 'warning');
      return;
    }
    const dataToExport = attempts.map((att, idx) => ({
      'م': idx + 1,
      'اسم الطالب': att.studentNameSnapshot,
      'المجموعة': att.studentGroupSnapshot,
      'الدرجة المستحقة': att.totalScore,
      'الدرجة الكلية': att.maxPossibleScore,
      'النسبة المئوية': `${att.percentage}%`,
      'حالة النتيجة': att.isPassed ? 'ناجح' : 'لم يجتز',
      'حالة التصحيح': att.status === 'graded' ? 'معتمد' : 'بانتظار المراجعة',
      'وقت البدء': formatArabicDateTime(att.startedAt),
      'وقت التسليم': att.submittedAt ? formatArabicDateTime(att.submittedAt) : '-',
      'ملاحظات المشرف': att.supervisorFeedback || '-',
    }));
    exportToExcel(dataToExport, `نتائج_${exam.title}`);
    showToast('تم تصدير ملف النتائج بنجاح! 📊', 'success');
  };

  // اعتماد الدرجة النهائية للمحاولة
  const handleApproveAttempt = (attId: string) => {
    const res = approveAndFinalizeAttempt(attId, supervisorFeedbackText);
    if (res.success) {
      showToast('تم اعتماد ورصد نتيجة الطالب بنجاح! 🎓', 'success');
      setSelectedAttemptId(null);
    } else {
      showToast(res.error || 'تعذر اعتماد النتيجة', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#f8fafc] w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header Strip */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 text-[#142e38] flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                نتائج وإحصائيات: {exam.title}
              </h2>
              <p className="text-xs text-slate-500">
                الدرجة الكلية: {exam.totalPoints} • درجة النجاح: {exam.passingScore} • {attempts.length} محاولات مسجلة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
              onClick={handleExportExcel}
            >
              تصدير Excel
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* بطاقات الإحصاءات العامة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-teal-700" /> المستهدفون
              </span>
              <span className="text-xl font-black text-slate-900 block">{stats.totalTargeted}</span>
              <span className="text-[10px] text-slate-400">شارك: {stats.started} طالب</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> نسبة النجاح
              </span>
              <span className="text-xl font-black text-emerald-700 block">{stats.passRate}%</span>
              <span className="text-[10px] text-slate-400">من المكتملين ({stats.completedCount})</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500" /> متوسط الدرجات
              </span>
              <span className="text-xl font-black text-slate-900 block">{stats.avgScore}</span>
              <span className="text-[10px] text-slate-400">من {exam.totalPoints} درجة</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-blue-600" /> أعلى / أقل درجة
              </span>
              <span className="text-xl font-black text-slate-900 block">
                {stats.maxScore} <span className="text-xs text-slate-400 font-normal">/ {stats.minScore}</span>
              </span>
              <span className="text-[10px] text-slate-400">أداء المجموعة</span>
            </div>
          </div>

          {/* إذا اختار المشرف مراجعة وتصحيح محاولة طالب محدد */}
          {selectedAttempt ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-5 sm:p-7 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedAttemptId(null)}
                    className="text-xs text-teal-700 font-bold hover:underline mb-1 inline-flex items-center gap-1"
                  >
                    ← العودة لقائمة الطلاب
                  </button>
                  <h3 className="text-lg font-black text-slate-900">
                    مراجعة وتصحيح إجابات: {selectedAttempt.studentNameSnapshot}
                  </h3>
                  <p className="text-xs text-slate-500">
                    المجموعة: {selectedAttempt.studentGroupSnapshot} • الدرجة المرصودة حالياً:{' '}
                    <strong>
                      {selectedAttempt.totalScore} من {selectedAttempt.maxPossibleScore} ({selectedAttempt.percentage}%)
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      selectedAttempt.isPassed
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {selectedAttempt.isPassed ? 'ناجح ✓' : 'لم يجتز ✕'}
                  </span>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<Check className="w-4 h-4" />}
                    onClick={() => handleApproveAttempt(selectedAttempt.id)}
                    className="bg-emerald-700 font-black shadow-sm"
                  >
                    اعتماد ورصد النتيجة النهائية
                  </Button>
                </div>
              </div>

              {/* استعراض كل سؤال وإجابة الطالب وتصحيحها */}
              <div className="space-y-5">
                {(selectedAttempt.examSnapshot.questions || []).map((q, idx) => {
                  const studentAns = selectedAttempt.answers[q.id];
                  const currentPts = studentAns?.awardedPoints ?? 0;

                  return (
                    <div
                      key={q.id}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#142e38] text-white flex items-center justify-center text-xs font-black">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-black text-slate-900">{q.title}</span>
                          </div>
                          {q.passageText && (
                            <p className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
                              {q.passageText}
                            </p>
                          )}
                        </div>

                        {/* صندوق تعديل درجة السؤال يدوياً */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                          <label className="text-xs font-bold text-slate-600">الدرجة:</label>
                          <input
                            type="number"
                            min={0}
                            max={q.points}
                            value={currentPts}
                            onChange={(e) =>
                              gradeAttemptQuestion(
                                selectedAttempt.id,
                                q.id,
                                Math.min(q.points, Math.max(0, Number(e.target.value)))
                              )
                            }
                            className="w-14 px-2 py-1 rounded-lg border border-slate-300 font-black text-center text-xs focus:ring-2 focus:ring-teal-700"
                          />
                          <span className="text-xs text-slate-400">/ {q.points}</span>
                        </div>
                      </div>

                      {/* إجابة الطالب */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 block">إجابة الطالب:</span>
                        {q.type === 'multiple_choice' || q.type === 'dropdown' ? (
                          <span className="font-black text-slate-800">
                            {q.options?.find((o) => o.id === studentAns?.selectedOptionIds?.[0])?.text ||
                              'لم يُجب'}
                          </span>
                        ) : q.type === 'checkboxes' ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(studentAns?.selectedOptionIds || []).map((optId) => (
                              <span
                                key={optId}
                                className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold"
                              >
                                {q.options?.find((o) => o.id === optId)?.text || optId}
                              </span>
                            ))}
                          </div>
                        ) : q.type === 'true_false' ? (
                          <span className="font-black text-slate-800">
                            {studentAns?.selectedBoolean === true
                              ? 'صح ✓'
                              : studentAns?.selectedBoolean === false
                              ? 'خطأ ✕'
                              : 'لم يُجب'}
                          </span>
                        ) : q.type === 'numeric' ? (
                          <span className="font-mono font-bold text-slate-900">
                            {studentAns?.numericAnswer ?? 'لم يُجب'}
                          </span>
                        ) : (
                          <p className="text-slate-800 leading-relaxed font-medium">
                            {studentAns?.textAnswer || 'لم يُجب الطالب على هذا السؤال'}
                          </p>
                        )}
                      </div>

                      {/* تعليق المشرف على هذا السؤال المحدد */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={studentAns?.supervisorComment || ''}
                          onChange={(e) =>
                            gradeAttemptQuestion(
                              selectedAttempt.id,
                              q.id,
                              currentPts,
                              e.target.value
                            )
                          }
                          placeholder="ملاحظة المشرف على هذا السؤال تظهر للطالب..."
                          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-1 focus:ring-teal-700 bg-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* الملاحظة العامة للمشرف */}
              <div className="space-y-1.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700">
                  توجيهات وملاحظات عامة للطالب على المحاولة:
                </label>
                <textarea
                  rows={2}
                  value={supervisorFeedbackText}
                  onChange={(e) => setSupervisorFeedbackText(e.target.value)}
                  placeholder="بارك الله فيك يا بطل، أحسنت في الفهم القرائي مع التنبيه على..."
                  className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs leading-relaxed focus:ring-2 focus:ring-teal-700"
                />
              </div>
            </div>
          ) : (
            /* جدول نتائج الطلاب والمحاولات */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden space-y-3">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-black text-sm text-slate-900">
                  قائمة المحاولات والنتائج ({attempts.length})
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    placeholder="بحث باسم الطالب..."
                    className="w-full pr-9 pl-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-1 focus:ring-teal-700"
                  />
                </div>
              </div>

              {attempts.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  لم يسجل أي طالب محاولة في هذا الاختبار بعد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <tr>
                        <th className="py-3 px-4">الطالب</th>
                        <th className="py-3 px-3">المجموعة</th>
                        <th className="py-3 px-3">الدرجة</th>
                        <th className="py-3 px-3">النسبة</th>
                        <th className="py-3 px-3">النتيجة</th>
                        <th className="py-3 px-3">الحالة</th>
                        <th className="py-3 px-3">وقت التسليم</th>
                        <th className="py-3 px-4 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attempts
                        .filter(
                          (a) =>
                            !searchStudent.trim() ||
                            a.studentNameSnapshot.includes(searchStudent.trim())
                        )
                        .map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-black text-slate-900">
                              {att.studentNameSnapshot}
                            </td>
                            <td className="py-3 px-3 text-slate-600">{att.studentGroupSnapshot}</td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-800">
                              {att.totalScore} / {att.maxPossibleScore}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-800">
                              {att.percentage}%
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  att.isPassed
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'bg-rose-50 text-rose-800'
                                }`}
                              >
                                {att.isPassed ? 'ناجح' : 'لم يجتز'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {att.status === 'grading_pending' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  بانتظار التصحيح
                                </span>
                              ) : att.status === 'graded' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                  معتمد
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  جارٍ الحل
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {att.submittedAt ? formatArabicDateTime(att.submittedAt) : 'لم يسلم'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={<Eye className="w-3.5 h-3.5" />}
                                onClick={() => {
                                  setSelectedAttemptId(att.id);
                                  setSupervisorFeedbackText(att.supervisorFeedback || '');
                                }}
                                className="text-xs font-bold"
                              >
                                تفاصيل وتصحيح
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
