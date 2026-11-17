import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Maximize2,
  RefreshCw,
  Reply,
  ShieldAlert,
  Smile,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { ChatMessage, ConversationStatus, MessageDeliveryStatus } from '../../types';
import { formatArabicDateTime } from '../../lib/dateUtils';

export const CONVERSATION_STATUS_META: Record<
  ConversationStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  open: {
    label: 'مفتوحة',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    dotClass: 'bg-emerald-500',
  },
  waiting_reply: {
    label: 'بانتظار الرد',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dotClass: 'bg-amber-500',
  },
  completed: {
    label: 'مكتملة',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-400',
  },
  archived: {
    label: 'مؤرشفة',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
    dotClass: 'bg-purple-500',
  },
};

export function formatShortMessageTime(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate));
  } catch {
    return '';
  }
}

export function formatMessageDateDivider(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) return 'اليوم';
    if (isYesterday) return 'أمس';

    return new Intl.DateTimeFormat('ar-SA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return '';
  }
}

export function formatLastSeenLabel(isoDate?: string): string {
  if (!isoDate) return 'غير متصل';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return 'متصل الآن';
  if (diffMins < 60) return `آخر ظهور منذ ${diffMins} د`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `آخر ظهور منذ ${diffHours} س`;
  return `آخر ظهور ${formatArabicDateTime(isoDate)}`;
}

/**
 * مؤشر حالة تسليم الرسالة (واتساب ستايل):
 * - ساعة متحركة: جاري الإرسال
 * - صح مفرد رمادي: تم الإرسال للمخدم
 * - صحين رمادية: تم التسليم لجهاز الطرف الآخر
 * - صحين زرقاء: تمت القراءة
 */
export const DeliveryStatusIndicator: React.FC<{
  status: MessageDeliveryStatus;
  errorReason?: string;
  onRetry?: () => void;
  lightOnDark?: boolean;
}> = ({ status, errorReason, onRetry, lightOnDark = false }) => {
  switch (status) {
    case 'sending':
      return (
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${
            lightOnDark ? 'text-white/70' : 'text-slate-400'
          }`}
          title="جارٍ الإرسال والتأمين..."
        >
          <Clock className="w-3 h-3 animate-spin" />
        </span>
      );
    case 'sent':
      return (
        <span
          className={`inline-flex items-center text-[10px] ${
            lightOnDark ? 'text-white/75' : 'text-slate-400'
          }`}
          title="تم الإرسال وحفظ الرسالة في الخادم"
        >
          <Check className="w-3.5 h-3.5" />
        </span>
      );
    case 'delivered':
      return (
        <span
          className={`inline-flex items-center text-[10px] ${
            lightOnDark ? 'text-white/80' : 'text-slate-400'
          }`}
          title="تم التسليم إلى صندوق وارد الطرف الآخر"
        >
          <CheckCheck className="w-3.5 h-3.5" />
        </span>
      );
    case 'read':
      return (
        <span
          className={`inline-flex items-center text-[10px] ${
            lightOnDark ? 'text-sky-300' : 'text-sky-600'
          }`}
          title="تمت قراءة الرسالة"
        >
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    case 'failed':
      return (
        <div className="inline-flex items-center gap-1.5 p-1 px-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[10px]">
          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>فشل الإرسال</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold hover:bg-rose-700 transition-colors"
            >
              إعادة
            </button>
          )}
        </div>
      );
  }
};

/**
 * فاصل التواريخ الأنيق بين الرسائل
 */
export const ChatDateSeparator: React.FC<{ dateLabel?: string; dateText?: string }> = ({ dateLabel, dateText }) => {
  const label = dateLabel || dateText;
  if (!label) return null;
  return (
    <div className="flex items-center justify-center my-4 select-none">
      <div className="h-px bg-slate-200/80 flex-1 max-w-[120px]" />
      <span className="mx-3 px-3 py-1 rounded-full bg-slate-100/90 text-slate-500 font-bold text-[11px] shadow-2xs border border-slate-200/60 backdrop-blur-xs">
        {label}
      </span>
      <div className="h-px bg-slate-200/80 flex-1 max-w-[120px]" />
    </div>
  );
};

const COMMON_EMOJIS = ['👍', '❤️', '👏', '📚', '⭐', '💡'];

/**
 * فقاعة الرسالة المطورة (تصميم عصري فخم مستوحى من كبرى تطبيقات المراسلة العالمية):
 * - بدون تكرار ترويسة الاسم المزعجة على كل رسالة للمرسل الحالي
 * - عرض الحواف بانسيابية (Edge-to-Edge) للصور والشهادات
 * - شريط أدوات عائم عند التحويم يتيح التفاعل بالإيموجي، الرد السريع، النسخ، والحذف
 * - مؤشر وقت وحالة تسليم دقيق مدمج بدون استهلاك مساحات رأسية
 */
export const ChatMessageBubble: React.FC<{
  message: ChatMessage;
  isOwnMessage: boolean;
  repliedMessage?: ChatMessage;
  searchQuery?: string;
  canDelete?: boolean;
  currentUserId?: string;
  onReply?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onRetry?: (messageId: string) => void;
  onPreviewImage?: (url: string, name?: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onReact?: (emoji: string) => void;
}> = ({
  message,
  isOwnMessage,
  repliedMessage,
  searchQuery = '',
  canDelete = false,
  currentUserId,
  onReply,
  onDelete,
  onRetry,
  onPreviewImage,
  onToggleReaction,
  onReact,
}) => {
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // 1. رسائل النظام الإدارية والتنبيهات العامة
  if (message.senderType === 'system') {
    const sanitizedSystemContent = message.content
      .replace(/مكتبة وثبة الذكية/g, 'مكتبة مداد')
      .replace(/مكتبة وثبة/g, 'مكتبة مداد')
      .replace(/نظام التواصل الداخلي لمكتبة وثبة الذكية/g, 'نظام التواصل الداخلي لمكتبة مداد')
      .replace(/النظام الترحيبي لمكتبة وثبة/g, 'النظام الترحيبي لمكتبة مداد')
      .replace(/وثبة/g, 'مداد');

    if (message.systemEventType === 'welcome') {
      return (
        <div className="flex justify-center my-4 px-3">
          <div className="max-w-[94%] sm:max-w-[82%] p-4 sm:p-5 rounded-2xl text-center bg-gradient-to-b from-[#f2f7f9] via-white to-[#f7fafb] border border-[#3b707d]/25 shadow-sm space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#3b707d]/10 text-[#2c5661] text-[11px] font-black border border-[#3b707d]/20 mx-auto">
              <span className="text-amber-600">✨</span>
              <span>نظام التواصل الداخلي • مكتبة مداد</span>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-medium">
              {sanitizedSystemContent}
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span className="flex items-center gap-1 text-[#3b707d]">
                <span>🔒</span> قناة تواصل موثقة ومباشرة
              </span>
              <span dir="ltr">{formatShortMessageTime(message.createdAt)}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center my-2.5 px-3">
        <div className="max-w-[92%] sm:max-w-[80%] px-4 py-2 rounded-2xl text-[11px] leading-relaxed text-center border shadow-2xs bg-slate-100/90 border-slate-200 text-slate-600">
          <span className="block">{sanitizedSystemContent}</span>
          <span className="block text-[9px] opacity-60 mt-0.5" dir="ltr">
            {formatShortMessageTime(message.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  const renderHighlightedContent = (text: string) => {
    const q = searchQuery.trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={idx} className="bg-amber-300 text-slate-900 rounded px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const hasImage = Boolean(message.attachmentUrl && message.attachmentType === 'image');
  const hasFile = Boolean(message.attachmentUrl && message.attachmentType === 'file');
  const hasText = Boolean(message.content && message.content.trim().length > 0);

  return (
    <div
      className={`group relative flex flex-col ${
        isOwnMessage ? 'items-start' : 'items-end'
      } my-1 px-1 transition-all`}
    >
      {/* الشريط العائم للإجراءات السريعة عند التحويم (Hover Action Toolbar) */}
      {!message.isDeleted && (
        <div
          className={`absolute z-10 -top-4.5 ${
            isOwnMessage ? 'left-4' : 'right-4'
          } opacity-0 group-hover:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 flex items-center gap-0.5 p-0.5 px-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-md text-slate-600`}
        >
          {/* تفاعلات الإيموجي السريعة */}
          {(onToggleReaction || onReact) && (
            <div className="flex items-center gap-0.5 pl-1 border-l border-slate-200">
              {COMMON_EMOJIS.slice(0, 3).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    if (onToggleReaction) onToggleReaction(message.id, emoji);
                    if (onReact) onReact(emoji);
                  }}
                  className="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-xs transition-transform hover:scale-125"
                  title={`تفاعل بـ ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-amber-500"
                  title="المزيد من التفاعلات"
                >
                  <Smile className="w-3.5 h-3.5" />
                </button>
                {showEmojiPicker && (
                  <div
                    className="absolute bottom-8 right-0 z-20 flex items-center gap-1 p-1 bg-white rounded-2xl shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-100"
                    onMouseLeave={() => setShowEmojiPicker(false)}
                  >
                    {COMMON_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          if (onToggleReaction) onToggleReaction(message.id, emoji);
                          if (onReact) onReact(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-sm transition-transform hover:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* زر الرد */}
          {onReply && message.deliveryStatus !== 'failed' && (
            <button
              type="button"
              onClick={() => onReply(message)}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-[#244b55] transition-colors"
              title="رد على الرسالة"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}

          {/* زر نسخ النص */}
          {hasText && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
              title={copied ? 'تم النسخ!' : 'نسخ نص الرسالة'}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* زر الحذف */}
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message)}
              className="p-1 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="حذف الرسالة"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* بطاقة الفقاعة الأساسية */}
      <div
        className={`relative max-w-[88%] sm:max-w-[74%] md:max-w-[66%] transition-all ${
          message.isDeleted
            ? 'p-3 rounded-2xl bg-slate-100/90 text-slate-500 border border-dashed border-slate-300'
            : isOwnMessage
            ? 'rounded-2xl rounded-br-xs bg-gradient-to-br from-[#1d3d46] via-[#244b55] to-[#2d5c68] text-white shadow-xs'
            : 'rounded-2xl rounded-bl-xs bg-white text-slate-800 border border-slate-200/80 shadow-xs'
        } ${hasImage ? 'overflow-hidden p-1.5 pb-2 sm:p-2 sm:pb-2.5' : 'p-3 sm:p-3.5'}`}
      >
        {/* ترويسة اسم المرسل: تظهر فقط للطرف المقابل لتجنب التكرار المزعج في رسائل المستخدم نفسه */}
        {!isOwnMessage && !message.isDeleted && (
          <div className="flex items-center justify-between gap-3 mb-1 px-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-black text-[#244b55] truncate">
                {message.senderName.replace(/وثبة/g, 'مداد')}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-[#e3ecf3] text-[#244b55]">
                {message.senderType === 'student' ? 'طالب' : 'مشرف'}
              </span>
            </div>
          </div>
        )}

        {/* الرسالة المقتبس منها (Quoted Message) */}
        {repliedMessage && !message.isDeleted && (
          <div
            className={`mb-2 mx-1 px-2.5 py-1.5 rounded-xl border-r-3 text-[11px] backdrop-blur-xs ${
              isOwnMessage
                ? 'bg-black/20 border-emerald-300/80 text-white/90'
                : 'bg-slate-50 border-[#244b55] text-slate-700'
            }`}
          >
            <div className="font-bold text-[10px] opacity-90 truncate">
              {repliedMessage.senderName}
            </div>
            <div className="truncate opacity-85 text-[10px]">
              {repliedMessage.isDeleted
                ? 'رسالة محذوفة'
                : repliedMessage.content || repliedMessage.attachmentName || 'مرفق'}
            </div>
          </div>
        )}

        {/* حالة الرسالة المحذوفة */}
        {message.isDeleted ? (
          <div className="flex items-center gap-1.5 text-xs italic text-slate-500 py-0.5">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              تم حذف هذه الرسالة {message.deletedByName ? `بواسطة ${message.deletedByName}` : ''}
            </span>
          </div>
        ) : (
          <>
            {/* الصورة المرفقة أو الشهادة بنظام الحواف الانسيابية (Edge-to-Edge) */}
            {hasImage && (
              <div className="relative group/media overflow-hidden rounded-xl bg-black/5">
                <button
                  type="button"
                  onClick={() => onPreviewImage?.(message.attachmentUrl!, message.attachmentName)}
                  className="block w-full focus:outline-none"
                >
                  <img
                    src={message.attachmentUrl}
                    alt={message.attachmentName || 'صورة مرفقة'}
                    className="max-h-72 sm:max-h-80 w-auto max-w-full rounded-xl object-contain mx-auto transition-transform duration-200 group-hover/media:scale-[1.01]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity flex items-end justify-between p-2.5 text-white">
                    <span className="text-[11px] font-bold flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5" />
                      تكبير ومعاينة
                    </span>
                    <a
                      href={message.attachmentUrl}
                      download={message.attachmentName || 'image.jpg'}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-xs transition-colors"
                      title="تحميل الصورة"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </button>
              </div>
            )}

            {/* المستند المرفق (PDF أو ملف) */}
            {hasFile && (
              <a
                href={message.attachmentUrl}
                download={message.attachmentName || 'document'}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-1 mb-1.5 flex items-center justify-between gap-3 p-2.5 rounded-xl border text-xs transition-all ${
                  isOwnMessage
                    ? 'bg-white/10 hover:bg-white/15 border-white/20 text-white'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isOwnMessage ? 'bg-white/20 text-white' : 'bg-[#e3ecf3] text-[#244b55]'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 text-right">
                    <span className="block truncate font-bold text-xs">
                      {message.attachmentName || 'مستند مرفق'}
                    </span>
                    <span className="block text-[10px] opacity-75">انقر للتحميل والمشاهدة</span>
                  </div>
                </div>
                <Download className="w-4 h-4 shrink-0 opacity-80" />
              </a>
            )}

            {/* نص الرسالة */}
            {hasText && (
              <p
                className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                  hasImage ? 'mt-2 px-1' : ''
                }`}
              >
                {renderHighlightedContent(
                  message.content
                    .replace(/مكتبة وثبة الذكية/g, 'مكتبة مداد')
                    .replace(/مكتبة وثبة/g, 'مكتبة مداد')
                    .replace(/وثبة/g, 'مداد')
                )}
              </p>
            )}

            {/* الوقت وحالة القراءة مدمجة في الزاوية بأناقة */}
            <div
              className={`flex items-center justify-end gap-1.5 mt-1.5 pt-0.5 select-none ${
                hasImage && !hasText ? 'px-1' : ''
              }`}
            >
              <span
                className={`text-[10px] font-mono leading-none ${
                  isOwnMessage ? 'text-white/70' : 'text-slate-400'
                }`}
              >
                {formatShortMessageTime(message.createdAt)}
              </span>

              {isOwnMessage && (
                <DeliveryStatusIndicator
                  status={message.deliveryStatus}
                  errorReason={message.errorReason}
                  onRetry={onRetry ? () => onRetry(message.id) : undefined}
                  lightOnDark={true}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* تفاعلات الإيموجي تحت الرسالة (Emoji Reactions Pills) */}
      {!message.isDeleted && message.reactions && Object.keys(message.reactions).length > 0 && (
        <div
          className={`flex items-center flex-wrap gap-1 mt-1 ${
            isOwnMessage ? 'mr-1' : 'ml-1'
          }`}
        >
          {Object.entries(message.reactions).map(([emoji, users]) => {
            if (!users || users.length === 0) return null;
            const hasMyReaction = currentUserId ? users.includes(currentUserId) : false;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction?.(message.id, emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition-transform hover:scale-110 ${
                  hasMyReaction
                    ? 'bg-[#e3ecf3] border-[#3b707d] text-[#244b55] shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title={`${users.length} تفاعل`}
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-mono">{users.length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * نافذة معاينة وتكبير الصور الاحترافية (Lightbox Modal)
 */
export const ImageLightboxModal: React.FC<{
  image: { url: string; name?: string } | null;
  onClose: () => void;
}> = ({ image, onClose }) => {
  if (!image) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-4 h-4 text-[#244b55] shrink-0" />
            <span className="text-xs sm:text-sm font-black text-slate-800 truncate">
              {image.name || 'معاينة الصورة المرفقة'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={image.url}
              download={image.name || 'image.jpg'}
              className="px-3 py-1.5 rounded-xl bg-[#244b55] hover:bg-[#1d3d46] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition-colors"
              aria-label="إغلاق المعاينة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-slate-950/95 flex-1 flex items-center justify-center p-4 overflow-auto min-h-[300px]">
          <img
            src={image.url}
            alt={image.name || 'صورة مرفقة'}
            className="max-h-[76vh] w-auto rounded-xl object-contain shadow-2xl transition-transform"
          />
        </div>
      </div>
    </div>
  );
};
