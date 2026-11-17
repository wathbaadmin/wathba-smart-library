/**
 * ========================================================================
 * نظام المزامنة الفورية والتحديث المباشر — مكتبة مداد
 * أنواع البيانات وبروتوكول المزامنة المركزية
 * ========================================================================
 */

export type SyncEntity =
  | 'categories'
  | 'books'
  | 'copies'
  | 'students'
  | 'staff'
  | 'loans'
  | 'loanEvents'
  | 'reservations'
  | 'returnRequests'
  | 'exchangeRequests'
  | 'readingLogs'
  | 'readingLogCorrections'
  | 'readingRanks'
  | 'studentRanks'
  | 'readingCertificates'
  | 'discussions'
  | 'discussionGroups'
  | 'discussionSettings'
  | 'reportSettings'
  | 'groupReportSummaries'
  | 'studentReportNotes'
  | 'exams'
  | 'examAttempts'
  | 'readingCompletions'
  | 'conversations'
  | 'messages'
  | 'settings'
  | 'certificateSettings'
  | 'achievementSettings'
  | 'auditLogs'
  | 'notifications';

export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE' | 'STATUS_CHANGE';

export type SyncConnectionState =
  | 'connected'  // متصل مباشرة بالسحابة المركزية ويستقبل التحديثات الفورية
  | 'saving'     // جارٍ حفظ وتأكيد العملية في قاعدة البيانات المركزية
  | 'synced'     // تمت المزامنة وكل البيانات مطابقة
  | 'offline'    // وضع غير متصل (يعمل محلياً ويخزن في قائمة الانتظار)
  | 'error';     // حدث خطأ في الاتصال وجارٍ إعادة المحاولة

export interface SyncStatusInfo {
  state: SyncConnectionState;
  label: string;
  isCloudConnected: boolean;
  latencyMs?: number;
  lastSyncedAt?: string;
  pendingOutboxCount: number;
  errorMessage?: string;
}

export interface SyncEventPayload<T = any> {
  eventId: string;
  entity: SyncEntity;
  action: SyncAction;
  recordId?: string;
  data: T;
  updatedAt: string;
  actorId?: string;
  actorName?: string;
  sourceTabId: string;
  dedupeKey?: string;
}

export interface SyncOutboxItem {
  id: string;
  entity: SyncEntity;
  action: SyncAction;
  recordId?: string;
  data: any;
  actorId?: string;
  actorName?: string;
  createdAt: string;
  retryCount: number;
}

export interface CustomSupabaseConfig {
  url: string;
  anonKey: string;
  savedAt: string;
  isEnabled: boolean;
}
