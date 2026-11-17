import { ReportPeriodPreset } from '../types';
import { formatArabicDate } from './dateUtils';

export interface ResolvedPeriodRange {
  preset: ReportPeriodPreset;
  key: string;
  label: string;
  startMs: number | null;
  endMs: number | null;
  prevStartMs: number | null;
  prevEndMs: number | null;
}

export function resolveReportPeriod(
  preset: ReportPeriodPreset,
  customFrom?: string,
  customTo?: string
): ResolvedPeriodRange {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  if (preset === 'this_week') {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    const span = Math.max(86400000, endOfToday - startMs);
    return {
      preset,
      key: 'this_week',
      label: 'الأسبوع الحالي',
      startMs,
      endMs: endOfToday,
      prevStartMs: startMs - 7 * 86400000,
      prevEndMs: startMs - 1,
    };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const startMs = start.getTime();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
    return {
      preset,
      key: `month-${now.getFullYear()}-${now.getMonth() + 1}`,
      label: 'الشهر الحالي',
      startMs,
      endMs: endOfToday,
      prevStartMs: prevStart,
      prevEndMs: startMs - 1,
    };
  }

  if (preset === 'last_30_days') {
    const span = 30 * 86400000;
    const startMs = endOfToday - span;
    return {
      preset,
      key: 'last_30_days',
      label: 'آخر 30 يوماً',
      startMs,
      endMs: endOfToday,
      prevStartMs: startMs - span,
      prevEndMs: startMs - 1,
    };
  }

  if (preset === 'this_term') {
    const span = 120 * 86400000;
    const startMs = endOfToday - span;
    return {
      preset,
      key: 'this_term',
      label: 'الفصل الدراسي الحالي (آخر 120 يوماً)',
      startMs,
      endMs: endOfToday,
      prevStartMs: startMs - span,
      prevEndMs: startMs - 1,
    };
  }

  if (preset === 'custom' && (customFrom || customTo)) {
    const startMs = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : null;
    const endMs = customTo ? new Date(`${customTo}T23:59:59`).getTime() : null;
    let prevStartMs: number | null = null;
    let prevEndMs: number | null = null;
    if (startMs && endMs && endMs >= startMs) {
      const span = Math.max(86400000, endMs - startMs);
      prevStartMs = startMs - span;
      prevEndMs = startMs - 1;
    }
    const label = `${customFrom ? formatArabicDate(customFrom) : 'البداية'} — ${
      customTo ? formatArabicDate(customTo) : 'الآن'
    }`;
    return {
      preset,
      key: `custom-${customFrom || ''}-${customTo || ''}`,
      label,
      startMs,
      endMs,
      prevStartMs,
      prevEndMs,
    };
  }

  // Fallback for 'all': compare last 30 days vs preceding 30 days for period comparison chart
  const monthSpan = 30 * 86400000;
  return {
    preset: 'all',
    key: 'all',
    label: 'جميع الفترات الزمنية',
    startMs: null,
    endMs: null,
    prevStartMs: endOfToday - monthSpan * 2,
    prevEndMs: endOfToday - monthSpan - 1,
  };
}

export function isTimestampInRange(
  iso?: string | null,
  startMs?: number | null,
  endMs?: number | null
): boolean {
  if (!iso) return false;
  if (!startMs && !endMs) return true;
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return false;
  if (startMs && ms < startMs) return false;
  if (endMs && ms > endMs) return false;
  return true;
}
