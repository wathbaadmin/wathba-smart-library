import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import { CopyStatus, ReservationStatus, ConditionRating } from '../../types';

interface BadgeProps {
  status?: CopyStatus | ReservationStatus | ConditionRating | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, label, size = 'sm', className = '' }) => {
  let displayLabel = label || status || '';
  let colorStyle = 'bg-slate-100 text-slate-700 border-slate-200';
  let icon: React.ReactNode = null;

  switch (status) {
    // حالات النسخ والكتب
    case 'available':
      displayLabel = label || 'متاح';
      colorStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      break;
    case 'borrowed':
      displayLabel = label || 'مستعار';
      colorStyle = 'bg-[#e3ecf3] text-[#27434b] border-[#c5d8df]';
      icon = <BookOpen className="w-3.5 h-3.5 text-[#3b707d] shrink-0" />;
      break;
    case 'reserved':
      displayLabel = label || 'محجوز';
      colorStyle = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      break;
    case 'in_preparation':
      displayLabel = label || 'قيد التجهيز';
      colorStyle = 'bg-sky-50 text-sky-800 border-sky-200';
      icon = <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
      break;
    case 'overdue':
      displayLabel = label || 'متأخر';
      colorStyle = 'bg-rose-50 text-rose-800 border-rose-200';
      icon = <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
      break;
    case 'under_inspection':
      displayLabel = label || 'قيد الفحص';
      colorStyle = 'bg-orange-50 text-orange-800 border-orange-200';
      icon = <Search className="w-3.5 h-3.5 text-orange-600 shrink-0" />;
      break;
    case 'damaged':
      displayLabel = label || 'متضررة';
      colorStyle = 'bg-rose-50 text-rose-900 border-rose-300';
      icon = <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />;
      break;
    case 'lost':
      displayLabel = label || 'مفقودة';
      colorStyle = 'bg-slate-200 text-slate-800 border-slate-300';
      icon = <XCircle className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
      break;
    case 'maintenance':
      displayLabel = label || 'تحت الصيانة';
      colorStyle = 'bg-cyan-50 text-cyan-800 border-cyan-200';
      icon = <Wrench className="w-3.5 h-3.5 text-cyan-700 shrink-0" />;
      break;

    // حالات الحجز والطلبات والاعتماد
    case 'new':
    case 'new_request':
    case 'pending':
    case 'pending_approval':
    case 'waiting_reply':
    case 'awaiting_schedule':
      displayLabel =
        label ||
        (status === 'waiting_reply'
          ? 'بانتظار الرد'
          : status === 'awaiting_schedule'
          ? 'بانتظار الموعد'
          : 'بانتظار الموافقة');
      colorStyle = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      break;
    case 'scheduled':
      displayLabel = label || 'تم تحديد الموعد';
      colorStyle = 'bg-[#e3ecf3] text-[#27434b] border-[#c5d8df]';
      icon = <Calendar className="w-3.5 h-3.5 text-[#3b707d] shrink-0" />;
      break;
    case 'approved':
    case 'active':
    case 'open':
      displayLabel =
        label ||
        (status === 'active' ? 'نشط' : status === 'open' ? 'مفتوحة' : 'معتمد');
      colorStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      break;
    case 'ready_for_pickup':
      displayLabel = label || 'جاهز للاستلام';
      colorStyle = 'bg-[#e3ecf3] text-[#162b31] border-[#3b707d]/30 font-bold';
      icon = <ShieldCheck className="w-3.5 h-3.5 text-[#3b707d] shrink-0" />;
      break;
    case 'completed':
    case 'fulfilled':
    case 'returned':
      displayLabel = label || (status === 'returned' ? 'معاد' : 'مكتمل');
      colorStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      break;
    case 'archived':
      displayLabel = label || 'مؤرشف';
      colorStyle = 'bg-slate-100 text-slate-700 border-slate-300';
      icon = <Archive className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
      break;
    case 'rejected':
    case 'cancelled':
    case 'suspended':
      displayLabel =
        label ||
        (status === 'cancelled' ? 'ملغي' : status === 'suspended' ? 'معلق' : 'مرفوض');
      colorStyle = 'bg-rose-50 text-rose-800 border-rose-200';
      icon = <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
      break;
    case 'needs_rediscussion':
      displayLabel = label || 'تحتاج إعادة';
      colorStyle = 'bg-orange-50 text-orange-800 border-orange-200';
      icon = <Eye className="w-3.5 h-3.5 text-orange-600 shrink-0" />;
      break;

    // تقييم الفحص
    case 'pristine':
      displayLabel = label || 'ممتاز وجديد';
      colorStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
      break;
    case 'good':
      displayLabel = label || 'سليم ونظيف';
      colorStyle = 'bg-[#e3ecf3] text-[#27434b] border-[#c5d8df]';
      icon = <CheckCircle2 className="w-3.5 h-3.5 text-[#3b707d] shrink-0" />;
      break;
    case 'needs_monitoring':
      displayLabel = label || 'يحتاج متابعة';
      colorStyle = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
      break;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-3.5 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold border shadow-sm whitespace-nowrap ${sizeClasses[size]} ${colorStyle} ${className}`}
    >
      {icon}
      <span>{displayLabel}</span>
    </span>
  );
};
