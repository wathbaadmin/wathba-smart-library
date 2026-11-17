import {
  ElectronicExam,
  ExamAttempt,
  ExamQuestion,
  ExamStatus,
  StudentQuestionAnswer,
} from '../types';

/**
 * دالة حساب حالة الاختبار الحالية استناداً إلى الإعدادات وتواريخ البداية والنهاية
 */
export function getComputedExamStatus(exam: ElectronicExam): ExamStatus {
  if (exam.status === 'draft' || exam.status === 'archived') {
    return exam.status;
  }

  const now = new Date().getTime();
  const start = new Date(exam.startsAt).getTime();
  const end = new Date(exam.endsAt).getTime();

  if (now < start) {
    return 'scheduled';
  }
  if (now > end || exam.status === 'closed') {
    return 'closed';
  }
  return 'published';
}

/**
 * التحقق مما إذا كان الطالب مستهدفاً بالاختبار
 */
export function isStudentTargeted(
  exam: ElectronicExam,
  studentId: string,
  studentGroupName?: string
): boolean {
  if (exam.targetAudienceType === 'all') {
    return true;
  }
  if (exam.targetAudienceType === 'group' && studentGroupName) {
    return (exam.targetGroupNames || []).includes(studentGroupName);
  }
  if (exam.targetAudienceType === 'custom_students') {
    return (exam.targetStudentIds || []).includes(studentId);
  }
  return false;
}

/**
 * فحص عدد المحاولات المتبقية للطالب
 */
export function getRemainingAttempts(
  exam: ElectronicExam,
  studentAttempts: ExamAttempt[]
): { remaining: number; totalAllowed: number; isExhausted: boolean } {
  const allowed = exam.allowedAttempts || 1;
  const completedAttempts = studentAttempts.filter(
    (a) => a.examId === exam.id && a.status !== 'cancelled'
  );
  const used = completedAttempts.length;

  if (allowed <= 0) {
    return { remaining: 999, totalAllowed: 0, isExhausted: false }; // غير محدود
  }

  const remaining = Math.max(0, allowed - used);
  return {
    remaining,
    totalAllowed: allowed,
    isExhausted: remaining <= 0,
  };
}

/**
 * محرك التصحيح الآلي لكل نوع من الأسئلة الموضوعية
 */
export function gradeSingleQuestion(
  question: ExamQuestion,
  rawAnswer?: Partial<StudentQuestionAnswer>
): {
  isCorrect: boolean;
  awardedPoints: number;
  needsManualReview: boolean;
} {
  const maxPts = question.points || 0;

  if (!rawAnswer) {
    return { isCorrect: false, awardedPoints: 0, needsManualReview: false };
  }

  switch (question.type) {
    // 1. اختيار من متعدد (إجابة واحدة)
    case 'multiple_choice':
    case 'dropdown': {
      const selectedId = rawAnswer.selectedOptionIds?.[0];
      const correctId =
        question.correctOptionIds?.[0] ||
        question.options?.find((o) => o.isCorrect)?.id;
      const isCorrect = Boolean(selectedId && selectedId === correctId);
      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPts : 0,
        needsManualReview: false,
      };
    }

    // 2. مربعات اختيار (أكثر من إجابة)
    case 'checkboxes': {
      const selected = new Set(rawAnswer.selectedOptionIds || []);
      const correctSet = new Set(
        question.correctOptionIds ||
          question.options?.filter((o) => o.isCorrect).map((o) => o.id) ||
          []
      );

      if (correctSet.size === 0) {
        return { isCorrect: false, awardedPoints: 0, needsManualReview: false };
      }

      // مطابقة كاملة
      let isAllCorrect = true;
      if (selected.size !== correctSet.size) {
        isAllCorrect = false;
      } else {
        for (const id of selected) {
          if (!correctSet.has(id)) {
            isAllCorrect = false;
            break;
          }
        }
      }

      return {
        isCorrect: isAllCorrect,
        awardedPoints: isAllCorrect ? maxPts : 0,
        needsManualReview: false,
      };
    }

    // 3. صح أو خطأ
    case 'true_false': {
      const isCorrect = rawAnswer.selectedBoolean === question.correctBoolean;
      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPts : 0,
        needsManualReview: false,
      };
    }

    // 4. سؤال رقمي
    case 'numeric': {
      const userNum = rawAnswer.numericAnswer;
      const targetNum = question.correctNumericAnswer;
      if (userNum === undefined || targetNum === undefined) {
        return { isCorrect: false, awardedPoints: 0, needsManualReview: false };
      }
      const tol = question.numericTolerance || 0;
      const isCorrect = Math.abs(userNum - targetNum) <= tol;
      return {
        isCorrect,
        awardedPoints: isCorrect ? maxPts : 0,
        needsManualReview: false,
      };
    }

    // 5. سؤال يتضمن صورة أو قراءة (إذا كان موضوعياً حسب خياراته)
    case 'image_based':
    case 'passage_based': {
      if (question.options && question.options.length > 0) {
        const selectedId = rawAnswer.selectedOptionIds?.[0];
        const correctId =
          question.correctOptionIds?.[0] ||
          question.options?.find((o) => o.isCorrect)?.id;
        const isCorrect = Boolean(selectedId && selectedId === correctId);
        return {
          isCorrect,
          awardedPoints: isCorrect ? maxPts : 0,
          needsManualReview: false,
        };
      }
      // إذا لم يكن له خيارات فهو سؤال مقالي
      return {
        isCorrect: false,
        awardedPoints: 0,
        needsManualReview: true,
      };
    }

    // 6. إجابة قصيرة
    case 'short_answer': {
      const userText = (rawAnswer.textAnswer || '').trim().toLowerCase();
      const keywords = (question.correctTextKeywords || []).map((k) =>
        k.trim().toLowerCase()
      );

      // إذا وضع المشرف كلمات مفتاحية للتصحيح الآلي
      if (keywords.length > 0 && userText) {
        const matched = keywords.some(
          (k) => userText === k || userText.includes(k)
        );
        if (matched) {
          return {
            isCorrect: true,
            awardedPoints: maxPts,
            needsManualReview: false,
          };
        }
      }

      // يحتاج لمراجعة المشرف
      return {
        isCorrect: false,
        awardedPoints: 0,
        needsManualReview: true,
      };
    }

    // 7. إجابة طويلة (فقرة)
    case 'long_answer':
    default: {
      return {
        isCorrect: false,
        awardedPoints: 0,
        needsManualReview: true,
      };
    }
  }
}

/**
 * خلط الأسئلة والخيارات عشوائياً للطالب إذا تم تفعيل الخيار
 */
export function prepareStudentExamQuestions(exam: ElectronicExam): ExamQuestion[] {
  let list = [...(exam.questions || [])];

  if (exam.settings?.randomizeQuestions) {
    list = shuffleArray(list);
  }

  if (exam.settings?.randomizeOptions) {
    list = list.map((q) => {
      if (q.options && q.options.length > 1) {
        return { ...q, options: shuffleArray(q.options) };
      }
      return q;
    });
  }

  return list;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * تنسيق الوقت المتبقي بالدقائق والثواني
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
