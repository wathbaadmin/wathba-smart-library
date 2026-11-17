/**
 * ========================================================================
 * محرك المزامنة المركزية الفورية (Central Real-Time Sync Service)
 * يضمن تحديث كافة الأجهزة والحسابات المفتوحة لحظياً دون الحاجة لإعادة تحميل الصفحة
 * ========================================================================
 */

import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import {
  SyncEntity,
  SyncAction,
  SyncConnectionState,
  SyncStatusInfo,
  SyncEventPayload,
  SyncOutboxItem,
} from './syncTypes';

export const SYNC_OUTBOX_STORAGE_KEY = 'midad_sync_outbox_v1';
export const TAB_INSTANCE_ID = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export const SYNC_BROADCAST_CHANNEL_NAME = 'midad_tab_sync_v1';
export const REALTIME_CENTRAL_CHANNEL_NAME = 'midad_central_sync_v1';

class CentralSyncService {
  private statusInfo: SyncStatusInfo = {
    state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced',
    label: typeof navigator !== 'undefined' && !navigator.onLine ? 'غير متصل' : 'تمت المزامنة',
    isCloudConnected: false,
    pendingOutboxCount: 0,
    lastSyncedAt: new Date().toISOString(),
  };

  private eventListeners = new Set<(event: SyncEventPayload) => void>();
  private statusListeners = new Set<(status: SyncStatusInfo) => void>();
  private localBroadcastChannel: BroadcastChannel | null = null;
  private realtimeChannel: any = null;
  private isFlushingOutbox = false;
  private heartbeatTimer: any = null;
  private lastSeenEventIds = new Set<string>();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // 1. تهيئة قناة البث المحلي للتبويبات على نفس الجهاز (BroadcastChannel)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.localBroadcastChannel = new BroadcastChannel(SYNC_BROADCAST_CHANNEL_NAME);
        this.localBroadcastChannel.onmessage = (e) => {
          if (!e.data || e.data.sourceTabId === TAB_INSTANCE_ID) return;
          this.handleIncomingEvent(e.data);
        };
      }
    } catch (err) {
      console.warn('Local BroadcastChannel initialization failed:', err);
    }

    // 2. الاستماع لأحداث الشبكة (Online / Offline)
    window.addEventListener('online', () => this.handleNetworkOnline());
    window.addEventListener('offline', () => this.handleNetworkOffline());

    // 3. تهيئة الاتصال السحابي المركزي عبر Supabase Realtime
    this.connectCloudRealtime();

    // 4. قراءة عدد العمليات العالقة في قائمة الانتظار
    this.updateOutboxCount();

    // 5. نبض فحص الاتصال التلقائي كل 45 ثانية
    this.heartbeatTimer = setInterval(() => {
      if (navigator.onLine && isSupabaseConfigured()) {
        this.pingCloudHealth();
      }
    }, 45000);
  }

  /**
   * ربط قناة البث السحابي المباشر عبر Supabase Realtime
   */
  public connectCloudRealtime() {
    if (!isSupabaseConfigured()) {
      this.updateStatus({
        state: 'synced',
        label: 'متزامن محلياً (جاهز للربط السحابي)',
        isCloudConnected: false,
      });
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    try {
      if (this.realtimeChannel) {
        client.removeChannel(this.realtimeChannel);
      }

      this.updateStatus({
        state: 'saving',
        label: 'جارٍ الاتصال بالسحابة المركزية...',
        isCloudConnected: false,
      });

      this.realtimeChannel = client.channel(REALTIME_CENTRAL_CHANNEL_NAME, {
        config: {
          broadcast: { self: false },
        },
      });

      // استقبال التحديثات الفورية المبثوثة من أي جهاز آخر في العالم
      this.realtimeChannel.on('broadcast', { event: 'MIDAD_MUTATION' }, (payloadWrapper: any) => {
        const payload: SyncEventPayload = payloadWrapper?.payload;
        if (payload && payload.sourceTabId !== TAB_INSTANCE_ID) {
          this.handleIncomingEvent(payload);
        }
      });

      this.realtimeChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          this.updateStatus({
            state: 'connected',
            label: 'متصل بالسحابة المركزية (مباشر)',
            isCloudConnected: true,
            lastSyncedAt: new Date().toISOString(),
          });
          // بعد الاشتراك بنجاح، نقوم بتفريغ العمليات المعلقة إن وجدت
          this.flushOutbox();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.updateStatus({
            state: 'error',
            label: 'فقد الاتصال بالسحابة — جارٍ إعادة الاتصال',
            isCloudConnected: false,
          });
        }
      });
    } catch (e: any) {
      console.warn('Supabase Realtime setup failed:', e);
      this.updateStatus({
        state: 'error',
        label: 'تعذر الاتصال بالسحابة',
        isCloudConnected: false,
        errorMessage: e?.message,
      });
    }
  }

  /**
   * معالجة حدث وارد من جهاز آخر أو تبويب آخر
   */
  private handleIncomingEvent(event: SyncEventPayload) {
    if (!event || !event.eventId || this.lastSeenEventIds.has(event.eventId)) {
      return; // منع المعالجة المتكررة لنفس الحدث
    }

    this.lastSeenEventIds.add(event.eventId);
    // الاحتفاظ بآخر 300 معرف حدث لتوفير الذاكرة
    if (this.lastSeenEventIds.size > 300) {
      const arr = Array.from(this.lastSeenEventIds);
      this.lastSeenEventIds = new Set(arr.slice(arr.length - 150));
    }

    this.updateStatus({
      lastSyncedAt: new Date().toISOString(),
      label: 'تم استقبال تحديث فوري مباشر',
      state: this.statusInfo.isCloudConnected ? 'connected' : 'synced',
    });

    // إخطار جميع المكونات المشتركة لتحديث واجهاتها فوراً
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in sync event listener:', err);
      }
    });
  }

  /**
   * بث عملية تعديل أو إضافة أو حذف إلى كافة التبويبات والأجهزة المتصلة
   */
  public async broadcastMutation<T = any>({
    entity,
    action,
    data,
    recordId,
    actorId,
    actorName,
    dedupeKey,
  }: {
    entity: SyncEntity;
    action: SyncAction;
    data: T;
    recordId?: string;
    actorId?: string;
    actorName?: string;
    dedupeKey?: string;
  }): Promise<{ success: boolean; eventId: string }> {
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const payload: SyncEventPayload<T> = {
      eventId,
      entity,
      action,
      data,
      recordId,
      actorId,
      actorName,
      sourceTabId: TAB_INSTANCE_ID,
      updatedAt: now,
      dedupeKey,
    };

    this.lastSeenEventIds.add(eventId);

    // 1. البث المحلي الفوري للتبويبات المفتوحة على نفس الجهاز
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage(payload);
      } catch (e) {
        console.warn('Broadcast to local tabs failed:', e);
      }
    }

    // 2. إذا كان الإنترنت متوفراً وقناة السحابة نشطة، يتم البث عبر Realtime لجميع الأجهزة الأخرى
    if (navigator.onLine && this.statusInfo.isCloudConnected && this.realtimeChannel) {
      try {
        this.updateStatus({ state: 'saving', label: 'جارٍ النشر السحابي المباشر...' });
        await this.realtimeChannel.send({
          type: 'broadcast',
          event: 'MIDAD_MUTATION',
          payload,
        });
        this.updateStatus({
          state: 'connected',
          label: 'تمت المزامنة المركزية بنجاح',
          lastSyncedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Cloud realtime broadcast failed, enqueuing in outbox:', err);
        this.enqueueOutbox({ entity, action, data, recordId, actorId, actorName });
      }
    } else if (!navigator.onLine) {
      // 3. في حالة انقطاع الإنترنت، نحفظ العملية في قائمة انتظار الإرسال التلقائي
      this.enqueueOutbox({ entity, action, data, recordId, actorId, actorName });
    }

    return { success: true, eventId };
  }

  /**
   * إضافة عملية إلى قائمة الانتظار للمزامنة عند استعادة الاتصال
   */
  private enqueueOutbox(item: Omit<SyncOutboxItem, 'id' | 'createdAt' | 'retryCount'>) {
    try {
      const outbox = this.getOutbox();
      const newItem: SyncOutboxItem = {
        ...item,
        id: `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };
      const updated = [...outbox, newItem];
      localStorage.setItem(SYNC_OUTBOX_STORAGE_KEY, JSON.stringify(updated));
      this.updateOutboxCount(updated.length);
      this.updateStatus({
        state: 'offline',
        label: `تم الحفظ محلياً (${updated.length} عمليات بانتظار الاتصال)`,
      });
    } catch (e) {
      console.error('Failed to enqueue sync outbox item:', e);
    }
  }

  /**
   * جلب عناصر قائمة الانتظار
   */
  public getOutbox(): SyncOutboxItem[] {
    try {
      const raw = localStorage.getItem(SYNC_OUTBOX_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * تفريغ ومزامنة عناصر قائمة الانتظار فور عودة الاتصال
   */
  public async flushOutbox(): Promise<{ processed: number; remaining: number }> {
    if (this.isFlushingOutbox || !navigator.onLine) {
      return { processed: 0, remaining: this.getOutbox().length };
    }

    const outbox = this.getOutbox();
    if (outbox.length === 0) return { processed: 0, remaining: 0 };

    this.isFlushingOutbox = true;
    this.updateStatus({ state: 'saving', label: `جارٍ مزامنة ${outbox.length} عمليات مؤجلة...` });

    let processedCount = 0;
    const remainingItems: SyncOutboxItem[] = [];

    for (const item of outbox) {
      try {
        await this.broadcastMutation({
          entity: item.entity,
          action: item.action,
          data: item.data,
          recordId: item.recordId,
          actorId: item.actorId,
          actorName: item.actorName,
        });
        processedCount++;
      } catch {
        if (item.retryCount < 5) {
          remainingItems.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    }

    try {
      localStorage.setItem(SYNC_OUTBOX_STORAGE_KEY, JSON.stringify(remainingItems));
    } catch (e) {
      console.warn('Failed to save remaining outbox items:', e);
    }

    this.isFlushingOutbox = false;
    this.updateOutboxCount(remainingItems.length);

    this.updateStatus({
      state: remainingItems.length > 0 ? 'error' : this.statusInfo.isCloudConnected ? 'connected' : 'synced',
      label:
        remainingItems.length > 0
          ? `فشل مزامنة ${remainingItems.length} عمليات — ستعاد المحاولة`
          : 'تمت مزامنة جميع العمليات العالقة بنجاح',
      lastSyncedAt: new Date().toISOString(),
    });

    return { processed: processedCount, remaining: remainingItems.length };
  }

  /**
   * فحص سريع لحالة واستجابة الاتصال السحابي
   */
  public async pingCloudHealth(): Promise<{ latencyMs: number; ok: boolean }> {
    if (!isSupabaseConfigured()) {
      return { latencyMs: 0, ok: false };
    }
    const client = getSupabaseClient();
    if (!client) return { latencyMs: 0, ok: false };

    try {
      const start = performance.now();
      const { error } = await client.from('categories').select('id').limit(1);
      const latencyMs = Math.round(performance.now() - start);

      if (!error) {
        this.updateStatus({
          latencyMs,
          isCloudConnected: true,
          state: 'connected',
        });
        return { latencyMs, ok: true };
      }
      return { latencyMs, ok: false };
    } catch {
      return { latencyMs: 0, ok: false };
    }
  }

  private handleNetworkOnline() {
    this.updateStatus({
      state: 'saving',
      label: 'عادت شبكة الإنترنت، جارٍ إعادة الاتصال والمزامنة...',
    });
    this.connectCloudRealtime();
    setTimeout(() => this.flushOutbox(), 1000);
  }

  private handleNetworkOffline() {
    this.updateStatus({
      state: 'offline',
      label: 'انقطع الاتصال بالإنترنت (يعمل محلياً)',
      isCloudConnected: false,
    });
  }

  private updateOutboxCount(count?: number) {
    const total = count !== undefined ? count : this.getOutbox().length;
    this.statusInfo.pendingOutboxCount = total;
    this.notifyStatusListeners();
  }

  private updateStatus(partial: Partial<SyncStatusInfo>) {
    this.statusInfo = { ...this.statusInfo, ...partial };
    this.notifyStatusListeners();
  }

  private notifyStatusListeners() {
    this.statusListeners.forEach((listener) => {
      try {
        listener(this.statusInfo);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    });
  }

  public getStatus(): SyncStatusInfo {
    return { ...this.statusInfo };
  }

  public subscribeToSyncEvents(listener: (event: SyncEventPayload) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public subscribeToStatus(listener: (status: SyncStatusInfo) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.statusInfo); // استدعاء فوري بالحالة الحالية
    return () => this.statusListeners.delete(listener);
  }

  public destroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.localBroadcastChannel) this.localBroadcastChannel.close();
    const client = getSupabaseClient();
    if (client && this.realtimeChannel) {
      client.removeChannel(this.realtimeChannel);
    }
  }
}

// كائن أحادي للخدمة على مستوى التطبيق (Singleton)
export const centralSync = new CentralSyncService();
