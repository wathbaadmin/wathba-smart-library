import React, { useState } from 'react';
import { ElectronicExam, ExamQuestion, ExamQuestionType, ExamSettings } from '../../../types';
import { Button } from '../../common/Button';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import {
  X,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  FileQuestion,
  Image as ImageIcon,
  BookOpen,
  Settings,
  Eye,
  Save,
  Send,
  HelpCircle,
  Hash,
  CheckSquare,
  ListOrdered,
  FileText,
  AlignLeft,
  ToggleLeft,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ExamEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  examToEdit?: ElectronicExam | null;
  defaultSupervisorName: string;
  defaultSupervisorId: string;
}

export const ExamEditorModal: React.FC<ExamEditorModalProps> = ({
  isOpen,
  onClose,
  examToEdit,
  defaultSupervisorName,
  defaultSupervisorId,
}) => {
  const { createExam, updateExam, students } = useLibrary();
  const { showToast } = useNotifications();

  // استخراج المجموعات المتاحة
  const availableGroups = Array.from(
    new Set(students.map((s) => s.groupName).filter(Boolean))
  ) as string[];

  const [activeTab, setActiveTab] = useState<'info' | 'questions' | 'settings' | 'preview'>('info');

  // البيانات الأساسية
  const [title, setTitle] = useState(examToEdit?.title || '');
  const [subject, setSubject] = useState(examToEdit?.subject || 'القراءة والفهم المعرفي');
  const [instructions, setInstructions] = useState(
    examToEdit?.instructions ||
      'يرجى قراءة الأسئلة بعناية واختيار الإجابة الصحيحة. يمكنك مراجعة إجاباتك قبل تسليم الاختبار.'
  );
  const [coverImageUrl, setCoverImageUrl] = useState(examToEdit?.coverImageUrl || '');
  const [targetAudienceType, setTargetAudienceType] = useState<'all' | 'group' | 'custom_students'>(
    examToEdit?.targetAudienceType || 'all'
  );
  const [targetGroupNames, setTargetGroupNames] = useState<string[]>(
    examToEdit?.targetGroupNames || []
  );
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>(
    examToEdit?.targetStudentIds || []
  );

  const [startsAt, setStartsAt] = useState(
    examToEdit?.startsAt
      ? examToEdit.startsAt.slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [endsAt, setEndsAt] = useState(
    examToEdit?.endsAt
      ? examToEdit.endsAt.slice(0, 16)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );

  const [durationMinutes, setDurationMinutes] = useState(examToEdit?.durationMinutes || 20);
  const [passingScore, setPassingScore] = useState(examToEdit?.passingScore || 10);
  const [allowedAttempts, setAllowedAttempts] = useState(
    examToEdit?.allowedAttempts !== undefined ? examToEdit.allowedAttempts : 1
  );

  // إعدادات الاختبار المتقدمة
  const [settings, setSettings] = useState<ExamSettings>(
    examToEdit?.settings || {
      randomizeQuestions: false,
      randomizeOptions: false,
      paginationMode: 'all',
      allowBackNavigation: true,
      allowReviewBeforeSubmit: true,
      resultsReleaseMode: 'immediate',
      showCorrectAnswers: 'always',
      preventRetakeAfterLimit: true,
      isPaused: false,
      extendedMinutes: 0,
    }
  );

  // قائمة الأسئلة
  const [questions, setQuestions] = useState<ExamQuestion[]>(
    examToEdit?.questions && examToEdit.questions.length > 0
      ? examToEdit.questions
      : [
          {
            id: 'q-1',
            type: 'multiple_choice',
            title: 'ما هي الفكرة الأساسية من قراءة هذا النص؟',
            points: 5,
            isRequired: true,
            order: 1,
            options: [
              { id: 'opt-1-1', text: 'الخيار الأول الصحيح', isCorrect: true },
              { id: 'opt-1-2', text: 'الخيار الثاني', isCorrect: false },
              { id: 'opt-1-3', text: 'الخيار الثالث', isCorrect: false },
            ],
            correctOptionIds: ['opt-1-1'],
          },
        ]
  );

  if (!isOpen) return null;

  const totalCalculatedPoints = questions.reduce(
    (sum, q) => sum + (Number(q.points) || 0),
    0
  );

  // إضافة سؤال جديد
  const handleAddQuestion = (type: ExamQuestionType = 'multiple_choice') => {
    const newQId = `q-${Date.now()}-${questions.length + 1}`;
    let initialOptions = undefined;
    let initialCorrectIds = undefined;
    let initialCorrectBool = undefined;

    if (type === 'multiple_choice' || type === 'dropdown') {
      initialOptions = [
        { id: `opt-${Date.now()}-1`, text: 'الخيار 1', isCorrect: true },
        { id: `opt-${Date.now()}-2`, text: 'الخيار 2', isCorrect: false },
      ];
      initialCorrectIds = [initialOptions[0].id];
    } else if (type === 'checkboxes') {
      initialOptions = [
        { id: `opt-${Date.now()}-1`, text: 'الخيار الأول', isCorrect: true },
        { id: `opt-${Date.now()}-2`, text: 'الخيار الثاني', isCorrect: false },
        { id: `opt-${Date.now()}-3`, text: 'الخيار الثالث', isCorrect: true },
      ];
      initialCorrectIds = [initialOptions[0].id, initialOptions[2].id];
    } else if (type === 'true_false') {
      initialCorrectBool = true;
    }

    const newQuestion: ExamQuestion = {
      id: newQId,
      type,
      title: '',
      points: 2,
      isRequired: true,
      order: questions.length + 1,
      options: initialOptions,
      correctOptionIds: initialCorrectIds,
      correctBoolean: initialCorrectBool,
    };

    setQuestions((prev) => [...prev, newQuestion]);
  };

  // تكرار سؤال
  const handleDuplicateQuestion = (idx: number) => {
    const q = questions[idx];
    const duplicated: ExamQuestion = {
      ...JSON.parse(JSON.stringify(q)),
      id: `q-${Date.now()}`,
      title: `${q.title} (نسخة)`,
      order: questions.length + 1,
    };
    const next = [...questions];
    next.splice(idx + 1, 0, duplicated);
    setQuestions(next.map((item, i) => ({ ...item, order: i + 1 })));
  };

  // حذف سؤال
  const handleDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) {
      showToast('يجب أن يحتوي الاختبار على سؤال واحد على الأقل.', 'warning');
      return;
    }
    const next = questions.filter((_, i) => i !== idx);
    setQuestions(next.map((item, i) => ({ ...item, order: i + 1 })));
  };

  // تحريك السؤال للأعلى أو الأسفل
  const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && idx === 0) ||
      (direction === 'down' && idx === questions.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...questions];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setQuestions(next.map((item, i) => ({ ...item, order: i + 1 })));
  };

  // تعديل حقل في سؤال
  const handleUpdateQuestion = (idx: number, updates: Partial<ExamQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...updates } : q))
    );
  };

  // إدارة الخيارات داخل السؤال
  const handleAddOption = (qIdx: number) => {
    const q = questions[qIdx];
    const newOpt = {
      id: `opt-${Date.now()}-${(q.options?.length || 0) + 1}`,
      text: `خيار جديد ${(q.options?.length || 0) + 1}`,
      isCorrect: false,
    };
    handleUpdateQuestion(qIdx, {
      options: [...(q.options || []), newOpt],
    });
  };

  const handleUpdateOption = (qIdx: number, optId: string, text: string) => {
    const q = questions[qIdx];
    const nextOpts = (q.options || []).map((o) =>
      o.id === optId ? { ...o, text } : o
    );
    handleUpdateQuestion(qIdx, { options: nextOpts });
  };

  const handleDeleteOption = (qIdx: number, optId: string) => {
    const q = questions[qIdx];
    if ((q.options || []).length <= 2) {
      showToast('يجب أن يحتوي السؤال على خيارين على الأقل.', 'warning');
      return;
    }
    const nextOpts = (q.options || []).filter((o) => o.id !== optId);
    const nextCorrect = (q.correctOptionIds || []).filter((id) => id !== optId);
    handleUpdateQuestion(qIdx, {
      options: nextOpts,
      correctOptionIds: nextCorrect,
    });
  };

  const handleToggleCorrectOption = (qIdx: number, optId: string) => {
    const q = questions[qIdx];
    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      const nextOpts = (q.options || []).map((o) => ({
        ...o,
        isCorrect: o.id === optId,
      }));
      handleUpdateQuestion(qIdx, {
        options: nextOpts,
        correctOptionIds: [optId],
      });
    } else if (q.type === 'checkboxes') {
      const isAlready = (q.correctOptionIds || []).includes(optId);
      const nextCorrect = isAlready
        ? (q.correctOptionIds || []).filter((id) => id !== optId)
        : [...(q.correctOptionIds || []), optId];
      const nextOpts = (q.options || []).map((o) => ({
        ...o,
        isCorrect: nextCorrect.includes(o.id),
      }));
      handleUpdateQuestion(qIdx, {
        options: nextOpts,
        correctOptionIds: nextCorrect,
      });
    }
  };

  // حفظ الاختبار (كنشر أو مسودة)
  const handleSave = (publishNow = false) => {
    if (!title.trim()) {
      showToast('يرجى كتابة عنوان الاختبار أولاً.', 'warning');
      setActiveTab('info');
      return;
    }

    if (questions.length === 0) {
      showToast('يجب إضافة سؤال واحد على الأقل.', 'warning');
      setActiveTab('questions');
      return;
    }

    // التحقق من صحة الأسئلة
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.title.trim()) {
        showToast(`السؤال رقم (${i + 1}) لا يحتوي على نص. يرجى إكماله.`, 'warning');
        setActiveTab('questions');
        return;
      }
    }

    const examPayload = {
      title: title.trim(),
      subject: subject.trim(),
      instructions: instructions.trim(),
      coverImageUrl: coverImageUrl.trim() || undefined,
      supervisorId: examToEdit?.supervisorId || defaultSupervisorId,
      supervisorName: examToEdit?.supervisorName || defaultSupervisorName,
      targetAudienceType,
      targetGroupNames: targetAudienceType === 'group' ? targetGroupNames : [],
      targetStudentIds: targetAudienceType === 'custom_students' ? targetStudentIds : [],
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      durationMinutes: Number(durationMinutes) || 20,
      totalPoints: totalCalculatedPoints,
      passingScore: Number(passingScore) || Math.ceil(totalCalculatedPoints * 0.6),
      allowedAttempts: Number(allowedAttempts),
      status: publishNow ? ('published' as const) : (examToEdit?.status || 'draft'),
      settings,
      questions,
    };

    if (examToEdit) {
      const res = updateExam(examToEdit.id, examPayload);
      if (res.success) {
        showToast('تم تحديث الاختبار وحفظ التغييرات بنجاح! ✨', 'success');
        onClose();
      } else {
        showToast(res.error || 'تعذر تحديث الاختبار', 'error');
      }
    } else {
      const res = createExam(examPayload);
      if (res.success) {
        showToast(
          publishNow ? 'تم إنشاء الاختبار ونشره للطلاب فوراً! 🚀' : 'تم حفظ مسودة الاختبار بنجاح.',
          'success'
        );
        onClose();
      } else {
        showToast(res.error || 'تعذر إنشاء الاختبار', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#f8fafc] w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header Strip */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 text-[#142e38] flex items-center justify-center shrink-0">
              <FileQuestion className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                {examToEdit ? 'تعديل الاختبار الإلكتروني' : 'محرر النماذج والاختبارات الذكية'}
              </h2>
              <p className="text-xs text-slate-500">
                {title || 'اختبار بدون عنوان'} • {questions.length} أسئلة ({totalCalculatedPoints} درجة)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'info'
                ? 'bg-[#142e38] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. إعدادات الاختبار والجمهور</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'questions'
                ? 'bg-[#142e38] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>2. محرر الأسئلة ({questions.length})</span>
            <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-800 text-[10px]">
              {totalCalculatedPoints} ن
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-[#142e38] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>3. الإعدادات والتصحيح</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-teal-700 hover:bg-teal-50'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>معاينة كما يراها الطالب</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* ================= 1. TAB: معلومات الاختبار الأساسية ================= */}
          {activeTab === 'info' && (
            <div className="max-w-3xl mx-auto space-y-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-soft">
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>البيانات التعريفية للاختبار</span>
                </h3>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">عنوان الاختبار *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="مثال: اختبار الفهم القرائي لكتاب رحلة إلى الفضاء"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">الموضوع / المادة</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="اللغة العربية، قصص السيرة، العلوم..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">رابط صورة الغلاف (اختياري)</label>
                    <input
                      type="text"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      placeholder="https://... أو مسار صورة"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-teal-700 focus:outline-none text-left"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">التعليمات والإرشادات للطلاب</label>
                  <textarea
                    rows={3}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="اكتب تعليمات تظهر للطالب قبل بدء الاختبار..."
                    className="w-full p-3.5 rounded-xl border border-slate-300 text-xs leading-relaxed focus:ring-2 focus:ring-teal-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* الجمهور المستهدف */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-teal-600" />
                  <span>تحديد الطلاب والجمهور المستهدف</span>
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetAudienceType('all')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      targetAudienceType === 'all'
                        ? 'bg-teal-50 border-teal-600 text-teal-900 font-black'
                        : 'bg-white border-slate-200 text-slate-600 font-bold hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">جميع طلاب المكتبة</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">متاح لجميع المجموعات</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudienceType('group')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      targetAudienceType === 'group'
                        ? 'bg-teal-50 border-teal-600 text-teal-900 font-black'
                        : 'bg-white border-slate-200 text-slate-600 font-bold hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">مجموعات محددة</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">تحديد أسماء المجموعات</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetAudienceType('custom_students')}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      targetAudienceType === 'custom_students'
                        ? 'bg-teal-50 border-teal-600 text-teal-900 font-black'
                        : 'bg-white border-slate-200 text-slate-600 font-bold hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs">طلاب محددين</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">اختيار بالاسم</div>
                  </button>
                </div>

                {targetAudienceType === 'group' && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">اختر المجموعات المستهدفة:</span>
                    <div className="flex flex-wrap gap-2">
                      {availableGroups.map((grp) => {
                        const isSelected = targetGroupNames.includes(grp);
                        return (
                          <button
                            key={grp}
                            type="button"
                            onClick={() => {
                              setTargetGroupNames((prev) =>
                                isSelected ? prev.filter((g) => g !== grp) : [...prev, grp]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                              isSelected
                                ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {grp}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* التوقيت والمدة والدرجات */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  <span>المواعيد والمدة والدرجات</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">تاريخ ووقت البداية</label>
                    <input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">تاريخ ووقت الانتهاء</label>
                    <input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">مدة الاختبار بالدقائق</label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">درجة النجاح</label>
                    <input
                      type="number"
                      min={1}
                      max={totalCalculatedPoints || 100}
                      value={passingScore}
                      onChange={(e) => setPassingScore(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      عدد المحاولات المسموح بها (0 = غير محدود)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={allowedAttempts}
                      onChange={(e) => setAllowedAttempts(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 2. TAB: محرر الأسئلة (Google Forms Style) ================= */}
          {activeTab === 'questions' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* شريط الإحصاءات السريعة وأزرار إضافة الأسئلة */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-800">
                    عدد الأسئلة: {questions.length}
                  </span>
                  <span className="text-xs font-black text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    مجموع الدرجات: {totalCalculatedPoints} نقطة
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => handleAddQuestion('multiple_choice')}
                    className="bg-[#142e38] text-xs font-bold"
                  >
                    + إضافة سؤال
                  </Button>
                </div>
              </div>

              {/* قائمة بطاقات الأسئلة */}
              <div className="space-y-5">
                {questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="bg-white rounded-3xl border-2 border-slate-200 shadow-card p-5 sm:p-6 space-y-4 transition-all hover:border-slate-300 relative group"
                  >
                    {/* شريط رأس السؤال (الرقم، النوع، والترتيب) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-[#142e38] text-white flex items-center justify-center text-xs font-black">
                          {qIdx + 1}
                        </span>

                        {/* محدد نوع السؤال المتقدم */}
                        <select
                          value={q.type}
                          onChange={(e) =>
                            handleUpdateQuestion(qIdx, {
                              type: e.target.value as ExamQuestionType,
                            })
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-700 focus:outline-none"
                        >
                          <option value="multiple_choice">🔘 اختيار من متعدد (إجابة واحدة)</option>
                          <option value="checkboxes">☑️ مربعات اختيار (أكثر من إجابة)</option>
                          <option value="true_false">⚖️ صح أو خطأ</option>
                          <option value="short_answer">✏️ إجابة قصيرة</option>
                          <option value="long_answer">📝 إجابة طويلة (فقرة)</option>
                          <option value="dropdown">🔽 قائمة منسدلة</option>
                          <option value="numeric">🔢 سؤال رقمي</option>
                          <option value="image_based">🖼️ سؤال يتضمن صورة</option>
                          <option value="passage_based">📖 سؤال يتضمن نص / فقرة قراءة</option>
                        </select>
                      </div>

                      {/* أدوات التحكم بالسؤال (تحريك، نسخ، حذف) */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(qIdx, 'up')}
                          disabled={qIdx === 0}
                          title="تحريك للأعلى"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveQuestion(qIdx, 'down')}
                          disabled={qIdx === questions.length - 1}
                          title="تحريك للأسفل"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateQuestion(qIdx)}
                          title="نسخ السؤال"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(qIdx)}
                          title="حذف السؤال"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* إذا كان السؤال يتضمن فقرة قراءة */}
                    {q.type === 'passage_based' && (
                      <div className="space-y-1.5 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
                        <label className="block text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-amber-700" />
                          <span>نص الفقرة القرائية للقراءة والفهم:</span>
                        </label>
                        <textarea
                          rows={3}
                          value={q.passageText || ''}
                          onChange={(e) =>
                            handleUpdateQuestion(qIdx, { passageText: e.target.value })
                          }
                          placeholder="اكتب هنا النص أو القصة التي يجب على الطالب قراءتها قبل الإجابة..."
                          className="w-full p-3 rounded-xl border border-amber-300 bg-white text-xs leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* إذا كان السؤال يتضمن صورة */}
                    {(q.type === 'image_based' || q.imageUrl) && (
                      <div className="space-y-1.5 bg-teal-50/50 p-3.5 rounded-2xl border border-teal-200">
                        <label className="block text-xs font-bold text-teal-900 flex items-center gap-1.5">
                          <ImageIcon className="w-4 h-4 text-teal-700" />
                          <span>رابط صورة السؤال:</span>
                        </label>
                        <input
                          type="text"
                          value={q.imageUrl || ''}
                          onChange={(e) =>
                            handleUpdateQuestion(qIdx, { imageUrl: e.target.value })
                          }
                          placeholder="https://... رابط الصورة التوضيحية"
                          className="w-full px-3 py-2 rounded-xl border border-teal-300 bg-white text-xs font-mono text-left focus:ring-2 focus:ring-teal-700 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* نص السؤال الأساسي */}
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={q.title}
                        onChange={(e) => handleUpdateQuestion(qIdx, { title: e.target.value })}
                        placeholder="اكتب نص السؤال هنا..."
                        className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm font-black focus:ring-2 focus:ring-teal-700 focus:outline-none bg-slate-50/50 focus:bg-white"
                      />
                    </div>

                    {/* وصف أو توضيح للسؤال (اختياري) */}
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={q.description || ''}
                        onChange={(e) =>
                          handleUpdateQuestion(qIdx, { description: e.target.value })
                        }
                        placeholder="وصف إضافي أو تلميح للطالب (اختياري)..."
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-500 focus:outline-none focus:border-slate-300"
                      />
                    </div>

                    {/* خيارات السؤال وفق النوع */}
                    {(q.type === 'multiple_choice' ||
                      q.type === 'checkboxes' ||
                      q.type === 'dropdown' ||
                      q.type === 'image_based' ||
                      q.type === 'passage_based') && (
                      <div className="space-y-2.5 pt-2">
                        <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                          <span>خيارات الإجابة (اضغط على الدائرة/المربع لتحديد الإجابة الصحيحة):</span>
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIdx)}
                            className="text-teal-700 hover:text-teal-900 text-xs font-black flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة خيار</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(q.options || []).map((opt) => {
                            const isCorrect = (q.correctOptionIds || []).includes(opt.id);
                            return (
                              <div
                                key={opt.id}
                                className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all ${
                                  isCorrect
                                    ? 'bg-emerald-50/70 border-emerald-300'
                                    : 'bg-white border-slate-200'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleCorrectOption(qIdx, opt.id)}
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'border-slate-300 hover:border-slate-400 bg-white'
                                  }`}
                                  title={isCorrect ? 'إجابة صحيحة' : 'تحديد كإجابة صحيحة'}
                                >
                                  {isCorrect && <CheckCircle2 className="w-4 h-4" />}
                                </button>

                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) =>
                                    handleUpdateOption(qIdx, opt.id, e.target.value)
                                  }
                                  placeholder="نص الخيار..."
                                  className="flex-1 bg-transparent border-0 text-xs font-bold focus:ring-0 focus:outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() => handleDeleteOption(qIdx, opt.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded-lg"
                                  title="حذف الخيار"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* سؤال صح أو خطأ */}
                    {q.type === 'true_false' && (
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          حدد الإجابة الصحيحة:
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(qIdx, { correctBoolean: true })}
                            className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                              q.correctBoolean === true
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            صح (True) ✓
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(qIdx, { correctBoolean: false })}
                            className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                              q.correctBoolean === false
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            خطأ (False) ✕
                          </button>
                        </div>
                      </div>
                    )}

                    {/* سؤال رقمي */}
                    {q.type === 'numeric' && (
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-700">
                            الرقم الصحيح المطلوب
                          </label>
                          <input
                            type="number"
                            value={q.correctNumericAnswer ?? ''}
                            onChange={(e) =>
                              handleUpdateQuestion(qIdx, {
                                correctNumericAnswer: Number(e.target.value),
                              })
                            }
                            placeholder="مثال: 42"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-bold text-slate-700">
                            هامش الخطأ المقبول (±)
                          </label>
                          <input
                            type="number"
                            value={q.numericTolerance ?? 0}
                            onChange={(e) =>
                              handleUpdateQuestion(qIdx, {
                                numericTolerance: Number(e.target.value),
                              })
                            }
                            placeholder="0"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {/* إجابة قصيرة */}
                    {q.type === 'short_answer' && (
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700">
                          الكلمات المفتاحية للتصحيح الآلي (مفصولة بفواصل):
                        </label>
                        <input
                          type="text"
                          value={(q.correctTextKeywords || []).join('، ')}
                          onChange={(e) =>
                            handleUpdateQuestion(qIdx, {
                              correctTextKeywords: e.target.value
                                .split('،')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="مثال: دمشق، الشام"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700 focus:outline-none"
                        />
                        <p className="text-[11px] text-slate-400">
                          إذا طابق جواب الطالب أي كلمة من الكلمات المفتاحية سيتم تصحيحه آلياً، وإلا يُحال للمراجعة اليدوية.
                        </p>
                      </div>
                    )}

                    {/* إجابة طويلة */}
                    {q.type === 'long_answer' && (
                      <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          هذا سؤال مقالي؛ سيُتاح للطالب كتابة إجابة تفصيلية ويتم تصحيحه يدوياً من قِبل المشرف لاحقاً.
                        </span>
                      </div>
                    )}

                    {/* تذييل بطاقة السؤال (الدرجة، الإلزام، والتفسير) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <label className="font-bold text-slate-700">الدرجة:</label>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={q.points}
                            onChange={(e) =>
                              handleUpdateQuestion(qIdx, {
                                points: Math.max(1, Number(e.target.value)),
                              })
                            }
                            className="w-16 px-2.5 py-1 rounded-lg border border-slate-300 font-bold text-center focus:ring-2 focus:ring-teal-700 focus:outline-none"
                          />
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={q.isRequired}
                            onChange={(e) =>
                              handleUpdateQuestion(qIdx, { isRequired: e.target.checked })
                            }
                            className="rounded text-teal-700 focus:ring-teal-700"
                          />
                          <span className="font-bold text-slate-700">سؤال إلزامي</span>
                        </label>
                      </div>

                      <div className="flex-1 max-w-sm">
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={(e) =>
                            handleUpdateQuestion(qIdx, { explanation: e.target.value })
                          }
                          placeholder="تفسير الإجابة الصحيحة والتغذية الراجعة..."
                          className="w-full px-3 py-1 rounded-xl border border-slate-200 text-[11px] text-slate-600 focus:outline-none focus:border-slate-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* زر إضافة سؤال عريض في الأسفل */}
              <div className="text-center pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  icon={<Plus className="w-5 h-5" />}
                  onClick={() => handleAddQuestion('multiple_choice')}
                  className="shadow-sm font-bold bg-[#142e38] px-6"
                >
                  + إضافة سؤال جديد
                </Button>
              </div>
            </div>
          )}

          {/* ================= 3. TAB: الإعدادات المتقدمة والتصحيح ================= */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-soft">
              <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Settings className="w-4 h-4 text-teal-600" />
                <span>خيارات العرض والأمان وسلوك الاختبار</span>
              </h3>

              <div className="space-y-4">
                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.randomizeQuestions}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, randomizeQuestions: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-teal-700 focus:ring-teal-700"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">
                      ترتيب الأسئلة عشوائياً لكل طالب
                    </span>
                    <span className="text-[11px] text-slate-500">
                      يمنع تطابق أرقام الأسئلة بين الطلاب للحد من النقل والتشابه.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.randomizeOptions}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, randomizeOptions: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-teal-700 focus:ring-teal-700"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">
                      ترتيب الخيارات عشوائياً داخل السؤال
                    </span>
                    <span className="text-[11px] text-slate-500">
                      إعادة ترتيب أماكن خيارات الإجابة تلقائياً عند كل محاولة.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allowBackNavigation}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, allowBackNavigation: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-teal-700 focus:ring-teal-700"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-800 block">
                      السماح بالرجوع للأسئلة السابقة وتعديل الإجابة
                    </span>
                    <span className="text-[11px] text-slate-500">
                      يُمكّن الطالب من مراجعة وتعديل إجاباته السابقة قبل تسليم الاختبار نهائياً.
                    </span>
                  </div>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">طريقة عرض الأسئلة</label>
                    <select
                      value={settings.paginationMode}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          paginationMode: e.target.value as 'single' | 'all',
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="all">جميع الأسئلة في صفحة واحدة</option>
                      <option value="single">سؤال واحد في كل صفحة (خطوة بخطوة)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">إعلان النتائج للطلاب</label>
                    <select
                      value={settings.resultsReleaseMode}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          resultsReleaseMode: e.target.value as 'immediate' | 'manual',
                        }))
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="immediate">إظهار النتيجة فور تسليم الطالب</option>
                      <option value="manual">بعد مراجعة واعتماد المشرف فقط</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= 4. TAB: المعاينة الحية ================= */}
          {activeTab === 'preview' && (
            <div className="max-w-2xl mx-auto space-y-6 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-soft">
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                  وضع المعاينة • تجربة الطالب
                </span>
                <h3 className="text-xl font-black text-slate-900">{title || 'عنوان الاختبار'}</h3>
                <p className="text-xs text-slate-500">{instructions}</p>
                <div className="flex items-center gap-3 text-xs text-slate-600 pt-2 font-bold">
                  <span>⏱️ المدة: {durationMinutes} دقيقة</span>
                  <span>🏆 الدرجة الكلية: {totalCalculatedPoints} درجة</span>
                  <span>🎯 درجة النجاح: {passingScore}</span>
                </div>
              </div>

              <div className="space-y-6">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-black">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-black text-slate-900">{q.title}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-500">({q.points} درجات)</span>
                    </div>

                    {q.passageText && (
                      <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs leading-relaxed text-slate-700">
                        {q.passageText}
                      </div>
                    )}

                    {q.imageUrl && (
                      <img src={q.imageUrl} alt="توضيح السؤال" className="max-h-48 rounded-xl object-contain mx-auto" />
                    )}

                    {/* خيارات تجريبية */}
                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {q.options.map((opt) => (
                          <div
                            key={opt.id}
                            className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 flex items-center gap-2"
                          >
                            <span className="w-4 h-4 rounded-full border border-slate-300" />
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>إجمالي الأسئلة: {questions.length}</span>
            <span>•</span>
            <span>الدرجة الكلية: {totalCalculatedPoints} درجة</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              إلغاء
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              icon={<Save className="w-4 h-4" />}
              onClick={() => handleSave(false)}
            >
              حفظ كمسودة
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              icon={<Send className="w-4 h-4" />}
              onClick={() => handleSave(true)}
              className="bg-emerald-700 hover:bg-emerald-800 font-black shadow-md"
            >
              نشر الاختبار للطلاب
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
