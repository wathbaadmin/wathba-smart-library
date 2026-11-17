import {
  ChatMessage,
  ChatNotificationSettings,
  ChatQueuedMessage,
  ChatRecipientType,
  Conversation,
  ConversationStatus,
  LibraryNotification,
} from '../types';
import { initialChatNotificationSettings } from '../data/initialData';
import { isSupabaseConfigured, supabase } from './supabase';

export const CHAT_SYNC_CHANNEL_NAME = 'wathba_chat_sync_v1';
export const CHAT_OUTBOX_STORAGE_KEY = 'wathba_chat_outbox_v1';
export const CHAT_SETTINGS_STORAGE_KEY = 'wathba_chat_settings_v1';
export const CHAT_NOTIF_EVENT_NAME = 'wathba:new-notification';
export const CHAT_OPEN_CONV_EVENT_NAME = 'wathba:open-chat-conversation';

export const ALLOWED_CHAT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const ALLOWED_CHAT_FILE_MIME_TYPES = [
  ...ALLOWED_CHAT_IMAGE_MIME_TYPES,
  'application/pdf',
  'text/plain',
];

export const MAX_CHAT_FILE_SIZE_LOCAL_BYTES = 2 * 1024 * 1024; // 2 MB لحماية التخزين المحلي
export const MAX_CHAT_FILE_SIZE_SUPABASE_BYTES = 5 * 1024 * 1024; // 5 MB للسحابة

export type ChatSyncEventPayload =
  | {
      type: 'LIBRARY_DATA_UPDATED';
      sourceTabId: string;
      conversationId?: string;
      messageId?: string;
      updatedAt: string;
    }
  | {
      type: 'CONVERSATION_READ';
      sourceTabId: string;
      conversationId: string;
      readerType: 'student' | 'supervisor' | 'admin';
      readAt: string;
    }
  | {
      type: 'MESSAGE_DELIVERED';
      sourceTabId: string;
      conversationId: string;
      messageIds: string[];
      deliveredAt: string;
    }
  | {
      type: 'PRESENCE_PING';
      sourceTabId: string;
      conversationId: string;
      actorType: 'student' | 'staff';
      lastSeenAt: string;
    }
  | {
      type: 'NOTIFICATION_EMIT';
      sourceTabId: string;
      notification: Omit<LibraryNotification, 'id' | 'createdAt' | 'isRead'>;
    };

export const TAB_INSTANCE_ID = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function getDeterministicConversationId(
  studentId: string,
  recipientType: ChatRecipientType,
  supervisorId?: string
): string {
  if (recipientType === 'admin') {
    return `conv-${studentId}-admin`;
  }
  return `conv-${studentId}-sup-${supervisorId || 'default'}`;
}

export function normalizeConversation(raw: any): Conversation {
  const supervisorId = raw?.supervisorId || undefined;
  const recipientType: ChatRecipientType =
    raw?.recipientType === 'admin' || raw?.recipientType === 'supervisor'
      ? raw.recipientType
      : supervisorId
      ? 'supervisor'
      : 'admin';

  const isArchived = Boolean(raw?.isArchived || raw?.status === 'archived');
  const status: ConversationStatus =
    raw?.status && ['open', 'waiting_reply', 'completed', 'archived'].includes(raw.status)
      ? raw.status
      : isArchived
      ? 'archived'
      : 'open';

  const rawLastMsg = String(raw?.lastMessageContent || '');
  const sanitizedLastMsg = rawLastMsg.replace(/مكتبة وثبة الذكية/g, 'مكتبة مداد').replace(/مكتبة وثبة/g, 'مكتبة مداد').replace(/وثبة/g, 'مداد');

  return {
    id: String(raw?.id || getDeterministicConversationId(String(raw?.studentId || ''), recipientType, supervisorId)),
    studentId: String(raw?.studentId || ''),
    recipientType,
    supervisorId: recipientType === 'supervisor' ? supervisorId : undefined,
    assignedAdminId: raw?.assignedAdminId || undefined,
    status,
    isPinned: Boolean(raw?.isPinned),
    pinnedAt: raw?.pinnedAt,
    pinnedById: raw?.pinnedById,
    isFollowUp: Boolean(raw?.isFollowUp),
    isArchived,
    archivedAt: raw?.archivedAt,
    archivedById: raw?.archivedById,
    lastMessageId: raw?.lastMessageId,
    lastMessageContent: sanitizedLastMsg,
    lastMessageAt: String(raw?.lastMessageAt || raw?.updatedAt || raw?.createdAt || new Date().toISOString()),
    lastMessageSenderType: raw?.lastMessageSenderType,
    unreadCountStudent: Number(raw?.unreadCountStudent || 0),
    unreadCountSupervisor: Number(raw?.unreadCountSupervisor || 0),
    studentLastSeenAt: raw?.studentLastSeenAt,
    staffLastSeenAt: raw?.staffLastSeenAt,
    welcomeShown: raw?.welcomeShown ?? true,
    participants: Array.isArray(raw?.participants) ? raw.participants : undefined,
    createdAt: String(raw?.createdAt || new Date().toISOString()),
    updatedAt: String(raw?.updatedAt || raw?.lastMessageAt || new Date().toISOString()),
  };
}

export function normalizeMessage(raw: any): ChatMessage {
  const isRead = Boolean(raw?.isRead);
  const deliveryStatus =
    raw?.deliveryStatus &&
    ['sending', 'sent', 'delivered', 'read', 'failed'].includes(raw.deliveryStatus)
      ? raw.deliveryStatus
      : isRead
      ? 'read'
      : 'delivered';

  const rawContent = String(raw?.content || '');
  const sanitizedContent = rawContent
    .replace(/مكتبة وثبة الذكية/g, 'مكتبة مداد')
    .replace(/مكتبة وثبة/g, 'مكتبة مداد')
    .replace(/نظام التواصل الداخلي لمكتبة وثبة الذكية/g, 'نظام التواصل الداخلي لمكتبة مداد')
    .replace(/النظام الترحيبي لمكتبة وثبة/g, 'النظام الترحيبي لمكتبة مداد')
    .replace(/فريق وثبة/g, 'فريق مداد');

  const rawSender = String(raw?.senderName || '');
  const sanitizedSender = rawSender
    .replace(/مكتبة وثبة الذكية/g, 'مكتبة مداد')
    .replace(/مكتبة وثبة/g, 'مكتبة مداد')
    .replace(/النظام الترحيبي لمكتبة وثبة/g, 'النظام الترحيبي لمكتبة مداد')
    .replace(/فريق وثبة/g, 'فريق مداد');

  return {
    id: String(raw?.id || `msg-${Date.now()}`),
    clientMessageId: raw?.clientMessageId,
    conversationId: String(raw?.conversationId || ''),
    senderType:
      raw?.senderType && ['student', 'supervisor', 'admin', 'system'].includes(raw.senderType)
        ? raw.senderType
        : 'student',
    senderId: String(raw?.senderId || ''),
    senderName: sanitizedSender,
    recipientType: raw?.recipientType,
    recipientId: raw?.recipientId,
    content: sanitizedContent,
    attachmentUrl: raw?.attachmentUrl,
    attachmentName: raw?.attachmentName,
    attachmentMimeType: raw?.attachmentMimeType,
    attachmentSize: raw?.attachmentSize,
    attachmentType: raw?.attachmentType === 'file' ? 'file' : raw?.attachmentUrl ? 'image' : undefined,
    replyToMessageId: raw?.replyToMessageId,
    deliveryStatus,
    errorReason: raw?.errorReason,
    isRead,
    deliveredAt: raw?.deliveredAt || (deliveryStatus !== 'sending' && deliveryStatus !== 'failed' ? raw?.createdAt : undefined),
    readAt: raw?.readAt || (isRead ? raw?.createdAt : undefined),
    isDeleted: Boolean(raw?.isDeleted),
    deletedAt: raw?.deletedAt,
    deletedById: raw?.deletedById,
    deletedByName: raw?.deletedByName,
    deletedReason: raw?.deletedReason,
    systemEventType: raw?.systemEventType,
    createdAt: String(raw?.createdAt || new Date().toISOString()),
    updatedAt: raw?.updatedAt,
  };
}

export function loadChatSettings(): ChatNotificationSettings {
  try {
    const raw = localStorage.getItem(CHAT_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const welcomeText = (parsed.welcomeMessageText || initialChatNotificationSettings.welcomeMessageText)
        .replace(/مكتبة وثبة الذكية/g, 'مكتبة مداد')
        .replace(/مكتبة وثبة/g, 'مكتبة مداد')
        .replace(/وثبة/g, 'مداد');
      return {
        ...initialChatNotificationSettings,
        ...parsed,
        welcomeMessageText: welcomeText,
      };
    }
  } catch (e) {
    console.warn('Failed reading chat settings:', e);
  }
  return initialChatNotificationSettings;
}

export function saveChatSettings(settings: ChatNotificationSettings): void {
  try {
    localStorage.setItem(CHAT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed saving chat settings:', e);
  }
}

export function loadChatOutbox(): ChatQueuedMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_OUTBOX_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('Failed loading chat outbox:', e);
  }
  return [];
}

export function saveChatOutbox(items: ChatQueuedMessage[]): void {
  try {
    localStorage.setItem(CHAT_OUTBOX_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed saving chat outbox:', e);
  }
}

export function broadcastChatEvent(payload: ChatSyncEventPayload): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHAT_SYNC_CHANNEL_NAME);
      channel.postMessage(payload);
      channel.close();
    }
  } catch (e) {
    console.warn('BroadcastChannel send failed:', e);
  }
}

export function emitScopedNotification(
  notification: Omit<LibraryNotification, 'id' | 'createdAt' | 'isRead'>,
  alsoBroadcastToOtherTabs = true
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_NOTIF_EVENT_NAME, {
        detail: notification,
      })
    );
  }
  if (alsoBroadcastToOtherTabs) {
    broadcastChatEvent({
      type: 'NOTIFICATION_EMIT',
      sourceTabId: TAB_INSTANCE_ID,
      notification,
    });
  }
}

export function triggerOpenChatConversation(
  conversationId: string,
  targetRole: 'student' | 'admin' | 'supervisor'
): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CHAT_OPEN_CONV_EVENT_NAME, {
        detail: { conversationId, targetRole },
      })
    );
  }
}

export function playChatNotificationTone(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.11);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore close error
      }
    }, 250);
  } catch {
    // Ignore autoplay restriction or unsupported browser WebAudio
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showBrowserPushNotification(title: string, body: string, conversationId?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
  try {
    const notif = new Notification(title, {
      body,
      tag: conversationId ? `wathba-chat-${conversationId}` : 'wathba-chat',
    });
    notif.onclick = () => {
      window.focus();
      if (conversationId) {
        triggerOpenChatConversation(conversationId, 'student');
      }
      notif.close();
    };
  } catch {
    // ignore browser notification failures
  }
}

export async function readAndValidateAttachment(
  file: File
): Promise<{
  success: boolean;
  error?: string;
  attachment?: {
    url: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    type: 'image' | 'file';
  };
}> {
  const lowerName = file.name.toLowerCase();
  const isImageByExt = /\.(jpe?g|png|webp|gif)$/i.test(lowerName);
  const isAllowedFileByExt = /\.(jpe?g|png|webp|gif|pdf|txt)$/i.test(lowerName);
  const isBlockedExt = /\.(svg|html?|js|mjs|ts|exe|bat|cmd|ps1|sh|php)$/i.test(lowerName);

  if (isBlockedExt || (!ALLOWED_CHAT_FILE_MIME_TYPES.includes(file.type) && !isAllowedFileByExt)) {
    return {
      success: false,
      error: 'نوع الملف غير مسموح به. يُسمح فقط بالصور (JPG, PNG, WEBP, GIF) ومستندات PDF أو TXT.',
    };
  }

  const maxSize = isSupabaseConfigured()
    ? MAX_CHAT_FILE_SIZE_SUPABASE_BYTES
    : MAX_CHAT_FILE_SIZE_LOCAL_BYTES;

  if (file.size > maxSize) {
    const maxMb = Math.round((maxSize / (1024 * 1024)) * 10) / 10;
    return {
      success: false,
      error: `حجم المرفق يتجاوز الحد المسموح (${maxMb} ميجابايت).`,
    };
  }

  const isImage = ALLOWED_CHAT_IMAGE_MIME_TYPES.includes(file.type) || isImageByExt;

  // If Supabase storage is configured, attempt upload first, fall back cleanly on error
  if (isSupabaseConfigured() && supabase) {
    try {
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const filePath = `chat/${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          return {
            success: true,
            attachment: {
              url: urlData.publicUrl,
              name: file.name,
              mimeType: file.type || (isImage ? 'image/jpeg' : 'application/pdf'),
              sizeBytes: file.size,
              type: isImage ? 'image' : 'file',
            },
          };
        }
      }
    } catch (e) {
      console.warn('Supabase attachment upload failed, falling back to verified local DataURL check:', e);
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        resolve({ success: false, error: 'تعذّر قراءة محتوى الملف المرفق.' });
        return;
      }
      resolve({
        success: true,
        attachment: {
          url: reader.result,
          name: file.name,
          mimeType: file.type || (isImage ? 'image/png' : 'application/pdf'),
          sizeBytes: file.size,
          type: isImage ? 'image' : 'file',
        },
      });
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'تعذّر قراءة الملف المحدد.' });
    };
    reader.readAsDataURL(file);
  });
}

export function verifyPersistedMessageInLocalStorage(storageKey: string, messageId: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.messages) && parsed.messages.some((m: any) => m.id === messageId);
  } catch {
    return false;
  }
}

export async function syncConversationAndMessageToSupabase(
  conv: Conversation,
  msg: ChatMessage
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: true };
  }

  try {
    const { error: convErr } = await supabase.from('conversations').upsert(
      {
        id: conv.id,
        student_id: conv.studentId,
        recipient_type: conv.recipientType,
        supervisor_id: conv.supervisorId || null,
        assigned_admin_id: conv.assignedAdminId || null,
        status: conv.status,
        is_pinned: Boolean(conv.isPinned),
        is_follow_up: Boolean(conv.isFollowUp),
        is_archived: Boolean(conv.isArchived),
        last_message_content: conv.lastMessageContent,
        last_message_at: conv.lastMessageAt,
        unread_count_student: conv.unreadCountStudent,
        unread_count_supervisor: conv.unreadCountSupervisor,
        updated_at: conv.updatedAt,
      },
      { onConflict: 'id' }
    );

    if (convErr) {
      return { ok: false, error: convErr.message || 'تعذّر حفظ المحادثة في قاعدة البيانات المركزية' };
    }

    const { error: msgErr } = await supabase.from('messages').insert({
      id: msg.id,
      client_message_id: msg.clientMessageId || null,
      conversation_id: msg.conversationId,
      sender_type: msg.senderType,
      sender_id: msg.senderId,
      sender_name: msg.senderName,
      recipient_type: msg.recipientType || conv.recipientType,
      recipient_id: msg.recipientId || null,
      content: msg.content,
      attachment_url: msg.attachmentUrl || null,
      attachment_name: msg.attachmentName || null,
      attachment_type: msg.attachmentType || null,
      reply_to_message_id: msg.replyToMessageId || null,
      delivery_status: 'sent',
      is_read: false,
      created_at: msg.createdAt,
    });

    if (msgErr) {
      // Handle idempotent duplicate client_message_id cleanly
      if (msgErr.code === '23505') {
        return { ok: true };
      }
      return { ok: false, error: msgErr.message || 'تعذّر حفظ الرسالة في الخادم المركزي' };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'حدث خطأ في الاتصال بالخادم أثناء إرسال الرسالة' };
  }
}

export async function markConversationReadInSupabase(
  conversationId: string,
  readerType: 'student' | 'supervisor' | 'admin'
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    const now = new Date().toISOString();
    await supabase
      .from('conversations')
      .update(
        readerType === 'student'
          ? { unread_count_student: 0, updated_at: now }
          : { unread_count_supervisor: 0, updated_at: now }
      )
      .eq('id', conversationId);

    const query = supabase
      .from('messages')
      .update({ is_read: true, delivery_status: 'read', read_at: now })
      .eq('conversation_id', conversationId)
      .eq('is_read', false);

    if (readerType === 'student') {
      await query.neq('sender_type', 'student');
    } else {
      await query.eq('sender_type', 'student');
    }
  } catch (e) {
    console.warn('Supabase mark read sync failed:', e);
  }
}
