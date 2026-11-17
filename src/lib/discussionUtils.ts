import { DiscussionStatus, ReadingDiscussion, DiscussionSettings, StaffUser } from '../types';

export interface DiscussionStatusMeta {
  key: DiscussionStatus | 'not_requested';
  label: string;
  badgeClass: string;
  description: string;
}

export function normalizeDiscussionStatus(status: DiscussionStatus): DiscussionStatus {
  if (status === 'pending') return 'awaiting_schedule';
  if (status === 'completed') return 'pending_approval';
  return status;
}

export function getDiscussionStatusMeta(
  status?: DiscussionStatus | 'not_requested'
): DiscussionStatusMeta {
  const normalized = !status || status === 'not_requested' ? 'not_requested' : normalizeDiscussionStatus(status);

  switch (normalized) {
    case 'not_requested':
      return {
        key: 'not_requested',
        label: 'لم يطلب المناقشة',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        description: 'لم يُقدم طلب مناقشة لهذا الكتاب بعد',
      };
    case 'requested':
      return {
        key: 'requested',
        label: 'طلب المناقشة',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
        description: 'تم استلام طلب الطالب للمناقشة',
      };
    case 'awaiting_schedule':
      return {
        key: 'awaiting_schedule',
        label: 'بانتظار تحديد الموعد',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        description: 'بانتظار تحديد المشرف لموعد المناقشة',
      };
    case 'scheduled':
      return {
        key: 'scheduled',
        label: 'تم تحديد الموعد',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        description: 'الموعد محدد بانتظار إجراء المناقشة',
      };
    case 'discussed':
      return {
        key: 'discussed',
        label: 'تمت المناقشة',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        description: 'أُجريت المناقشة وسُجل الملخص والتقييم',
      };
    case 'pending_approval':
      return {
        key: 'pending_approval',
        label: 'بانتظار اعتماد النتيجة',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
        description: 'سجّل المشرف النتيجة وهي بانتظار الاعتماد النهائي لإضافة النقاط',
      };
    case 'approved':
      return {
        key: 'approved',
        label: 'معتمدة',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        description: 'تمت المناقشة واعتماد النتيجة وإضافة النقاط للطالب',
      };
    case 'needs_rediscussion':
      return {
        key: 'needs_rediscussion',
        label: 'تحتاج إلى إعادة مناقشة',
        badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
        description: 'يرجى إعادة مراجعة الكتاب وتحديد موعد مناقشة جديد',
      };
    case 'cancelled':
      return {
        key: 'cancelled',
        label: 'ملغاة',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
        description: 'تم إلغاء هذا الطلب',
      };
    default:
      return {
        key: 'awaiting_schedule',
        label: 'بانتظار تحديد الموعد',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        description: '',
      };
  }
}

export function isDiscussionCompletedOrApproved(d: ReadingDiscussion): boolean {
  const s = normalizeDiscussionStatus(d.status);
  return s === 'discussed' || s === 'pending_approval' || s === 'approved';
}

export function isDiscussionPendingAction(d: ReadingDiscussion): boolean {
  const s = normalizeDiscussionStatus(d.status);
  return (
    s === 'requested' ||
    s === 'awaiting_schedule' ||
    s === 'scheduled' ||
    s === 'discussed' ||
    s === 'pending_approval' ||
    s === 'needs_rediscussion'
  );
}

export function getActiveEvaluationTemplate(settings: DiscussionSettings) {
  const templates = settings.templates || [];
  const active = templates.find((t) => t.id === settings.activeTemplateId) || templates[0];
  if (active && active.items.length > 0) {
    return active;
  }
  return {
    id: 'tpl-default',
    name: 'النموذج المعتمد',
    items: settings.evaluationItems,
    totalMaxPoints: settings.totalMaxPoints || 100,
  };
}

export function filterStudentsForStaffScope<T extends { groupName: string }>(
  items: T[],
  staff?: StaffUser | null
): T[] {
  if (!staff || staff.role === 'admin') return items;
  if (!staff.assignedGroups || staff.assignedGroups.length === 0) return items;
  return items.filter((item) => staff.assignedGroups!.includes(item.groupName));
}
