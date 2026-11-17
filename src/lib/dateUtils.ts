// ========================================================================
// دوال التواريخ والأوقات بتوقيت السعودية Asia/Riyadh والتقويم الهجري (أم القرى)
// ========================================================================

/**
 * تنسيق التاريخ الميلادي بصيغة عربية واضحة
 */
export function formatArabicDate(dateStr?: string | Date): string {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * تنسيق التاريخ والوقت بتوقيت الرياض
 */
export function formatArabicDateTime(dateStr?: string | Date): string {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('ar-SA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * تحويل وعرض التاريخ بالتقويم الهجري (تقويم أم القرى المعتمد بالمملكة العربية السعودية)
 * مثال: 15 جمادى الأولى 1448هـ
 */
export function formatUmmAlQuraDate(dateStr?: string | Date): string {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '-';

  try {
    // التقويم الهجري الرسمي أم القرى
    const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      timeZone: 'Asia/Riyadh',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    let formatted = formatter.format(date).replace(/،/g, '').trim();
    if (!formatted.includes('هـ')) {
      formatted = `${formatted}هـ`;
    }
    return formatted;
  } catch (e) {
    try {
      const fallbackFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        timeZone: 'Asia/Riyadh',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      let formatted = fallbackFormatter.format(date).replace(/،/g, '').trim();
      if (!formatted.includes('هـ')) {
        formatted = `${formatted}هـ`;
      }
      return formatted;
    } catch {
      return formatArabicDate(date);
    }
  }
}

/**
 * حساب الفرق الدقيق بالأيام التقويمية بتوقيت الرياض Asia/Riyadh
 * موجب = متبقي أيام
 * 0 = اليوم نفسه
 * سالب = متأخر
 */
export function calculateDaysDifferenceInRiyadh(targetDateStr: string | Date): number {
  if (!targetDateStr) return 0;
  const target = typeof targetDateStr === 'string' ? new Date(targetDateStr) : targetDateStr;
  if (isNaN(target.getTime())) return 0;
  const now = new Date();

  // تحويل التاريخين إلى تاريخ بصيغة YYYY-MM-DD وفق توقيت الرياض للتخلص من أثر فروق الساعات
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const targetParts = formatter.format(target).split('-').map(Number);
  const nowParts = formatter.format(now).split('-').map(Number);

  const targetUtc = Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2]);
  const nowUtc = Date.UTC(nowParts[0], nowParts[1] - 1, nowParts[2]);

  return Math.round((targetUtc - nowUtc) / (1000 * 60 * 60 * 24));
}

export type LoanCountdownStatus = 'safe' | 'warning' | 'today' | 'overdue';

export interface LoanCountdownInfo {
  diffDays: number;
  status: LoanCountdownStatus;
  label: string; // النص العربي المطلوب نصاً
  badgeColorClass: string;
  borderColorClass: string;
  bgColorClass: string;
  textColorClass: string;
  progressPercent: number; // للرسم البياني أو المؤشر
  hijriDate: string; // التاريخ الهجري بصيغة أم القرى
  gregorianDate: string; // التاريخ الميلادي المقابل
}

/**
 * حساب حالة العد التنازلي ونصوص العرض المعتمدة:
 * - متبقي 7 أيام.
 * - متبقي 3 أيام.
 * - متبقي يومان.
 * - متبقي يوم واحد.
 * - موعد الإرجاع اليوم.
 * - متأخر عن الإرجاع بيوم واحد.
 * - متأخر عن الإرجاع 3 أيام.
 */
export function getLoanCountdown(dueDateStr: string): LoanCountdownInfo {
  const diffDays = calculateDaysDifferenceInRiyadh(dueDateStr);
  const hijriDate = formatUmmAlQuraDate(dueDateStr);
  const gregorianDate = formatArabicDate(dueDateStr);

  if (diffDays > 3) {
    // 1. أخضر: المدة المتبقية أكثر من 3 أيام
    const dayWord =
      diffDays === 1
        ? 'يوم واحد'
        : diffDays === 2
        ? 'يومان'
        : diffDays >= 3 && diffDays <= 10
        ? `${diffDays} أيام`
        : `${diffDays} يوماً`;

    return {
      diffDays,
      status: 'safe',
      label: `متبقي ${dayWord}`,
      badgeColorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      borderColorClass: 'border-emerald-300 hover:border-emerald-400',
      bgColorClass: 'bg-emerald-50/60',
      textColorClass: 'text-emerald-700',
      progressPercent: Math.min(100, Math.max(30, (diffDays / 7) * 100)),
      hijriDate,
      gregorianDate,
    };
  } else if (diffDays >= 1 && diffDays <= 3) {
    // 2. برتقالي: تبقى 3 أيام أو أقل
    let label = '';
    if (diffDays === 1) {
      label = 'متبقي يوم واحد';
    } else if (diffDays === 2) {
      label = 'متبقي يومان';
    } else {
      label = `متبقي ${diffDays} أيام`;
    }

    return {
      diffDays,
      status: 'warning',
      label,
      badgeColorClass: 'bg-amber-100 text-amber-900 border-amber-300',
      borderColorClass: 'border-amber-300 hover:border-amber-400',
      bgColorClass: 'bg-amber-50/70',
      textColorClass: 'text-amber-800',
      progressPercent: Math.max(15, (diffDays / 7) * 100),
      hijriDate,
      gregorianDate,
    };
  } else if (diffDays === 0) {
    // 3. لون تنبيه واضح: موعد الإرجاع اليوم
    return {
      diffDays: 0,
      status: 'today',
      label: 'موعد الإرجاع اليوم',
      badgeColorClass: 'bg-amber-500 text-white border-amber-600 shadow-soft animate-pulse',
      borderColorClass: 'border-amber-500 ring-2 ring-amber-200',
      bgColorClass: 'bg-amber-100/70',
      textColorClass: 'text-amber-950 font-black',
      progressPercent: 10,
      hijriDate,
      gregorianDate,
    };
  } else {
    // 4. أحمر: تجاوز موعد الإرجاع
    const overdueDays = Math.abs(diffDays);
    let label = '';
    if (overdueDays === 1) {
      label = 'متأخر عن الإرجاع بيوم واحد';
    } else if (overdueDays === 2) {
      label = 'متأخر عن الإرجاع يومان';
    } else if (overdueDays >= 3 && overdueDays <= 10) {
      label = `متأخر عن الإرجاع ${overdueDays} أيام`;
    } else {
      label = `متأخر عن الإرجاع ${overdueDays} يوماً`;
    }

    return {
      diffDays,
      status: 'overdue',
      label,
      badgeColorClass: 'bg-rose-100 text-rose-800 border-rose-300 font-black',
      borderColorClass: 'border-rose-300 hover:border-rose-400',
      bgColorClass: 'bg-rose-50/80',
      textColorClass: 'text-rose-700 font-black',
      progressPercent: 0,
      hijriDate,
      gregorianDate,
    };
  }
}

export function isOverdue(dueDateStr: string): boolean {
  if (!dueDateStr) return false;
  return calculateDaysDifferenceInRiyadh(dueDateStr) < 0;
}

export function getDaysRemaining(dueDateStr: string): number {
  if (!dueDateStr) return 0;
  return calculateDaysDifferenceInRiyadh(dueDateStr);
}

export function addDaysToCurrent(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
