import React, { useState, useEffect } from 'react';
import { centralSync } from '../../lib/sync/centralSyncService';
import { SyncStatusInfo } from '../../lib/sync/syncTypes';
import { formatArabicDateTime } from '../../lib/dateUtils';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  HardDrive,
  Clock,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';

interface SyncStatusIndicatorProps {
  onOpenSettings?: () => void;
  compact?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  onOpenSettings,
  compact = false,
}) => {
  const [status, setStatus] = useState<SyncStatusInfo>(() => centralSync.getStatus());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = centralSync.subscribeToStatus((next) => {
      setStatus(next);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    setTestResult(null);
    try {
      const pingRes = await centralSync.pingCloudHealth();
      const flushRes = await centralSync.flushOutbox();
      if (pingRes.ok) {
        setTestResult(`تم الاتصال بالسحابة بنجاح (سرعة الاستجابة: ${pingRes.latencyMs}ms)`);
      } else {
        setTestResult('المزامنة تعمل محلياً عبر أجهزة الشبكة والتبويبات');
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  // ألوان وشارات الحالة
  const getBadgeStyle = () => {
    switch (status.state) {
      case 'connected':
        return {
          bg: 'bg-emerald-50 hover:bg-emerald-100/80',
          border: 'border-emerald-200',
          text: 'text-emerald-800',
          dot: 'bg-emerald-500 animate-pulse',
          icon: <Zap className="w-3.5 h-3.5 text-emerald-600" />,
          shortText: 'مباشر',
        };
      case 'saving':
        return {
          bg: 'bg-blue-50 hover:bg-blue-100/80',
          border: 'border-blue-200',
          text: 'text-blue-800',
          dot: 'bg-blue-500 animate-ping',
          icon: <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />,
          shortText: 'جارٍ الحفظ...',
        };
      case 'offline':
        return {
          bg: 'bg-amber-50 hover:bg-amber-100/80',
          border: 'border-amber-200',
          text: 'text-amber-800',
          dot: 'bg-amber-500',
          icon: <CloudOff className="w-3.5 h-3.5 text-amber-600" />,
          shortText: 'غير متصل (محلي)',
        };
      case 'error':
        return {
          bg: 'bg-rose-50 hover:bg-rose-100/80',
          border: 'border-rose-200',
          text: 'text-rose-800',
          dot: 'bg-rose-500',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
          shortText: 'تنبيه اتصال',
        };
      case 'synced':
      default:
        return {
          bg: 'bg-[#f4f7f9] hover:bg-[#e3ecf3]',
          border: 'border-[#dde6ed]',
          text: 'text-[#1c353d]',
          dot: 'bg-[#3b707d]',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#3b707d]" />,
          shortText: status.isCloudConnected ? 'متزامن سحابياً' : 'متزامن محلياً',
        };
    }
  };

  const badge = getBadgeStyle();

  return (
    <div className="relative inline-block text-right">
      {/* Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-black transition-all ${badge.bg} ${badge.border} ${badge.text} shadow-2xs`}
        title={`حالة المزامنة: ${status.label}`}
      >
        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
        {badge.icon}
        {!compact && <span className="hidden sm:inline">{badge.shortText}</span>}
        {status.pendingOutboxCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-md bg-amber-200 text-amber-900 text-[10px] font-mono">
            {status.pendingOutboxCount}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {/* Detail Popover Panel */}
      {popoverOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setPopoverOpen(false)}
          />
          <div className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#dde6ed] z-50 p-4 space-y-3.5 text-xs font-arabic animate-in fade-in-50 zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#284d57] to-[#3b707d] text-white flex items-center justify-center">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-[#1c353d] text-xs">نظام المزامنة والتحديث المباشر</h4>
                  <p className="text-[10px] text-slate-500">منصة مكتبة مداد المركزية</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${badge.bg} ${badge.border} ${badge.text}`}>
                {badge.shortText}
              </span>
            </div>

            {/* Status Details Grid */}
            <div className="bg-[#f8fafc] rounded-xl p-3 border border-slate-200/80 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#3b707d]" />
                  <span>حالة الاتصال:</span>
                </span>
                <strong className="text-[#1c353d]">{status.label}</strong>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[#3b707d]" />
                  <span>نوع قاعدة البيانات:</span>
                </span>
                <span className="font-bold text-[#284d57]">
                  {status.isCloudConnected ? 'سحابية مركزية (Supabase Live)' : 'قاعدة بيانات متزامنة محلياً'}
                </span>
              </div>

              {status.latencyMs !== undefined && status.latencyMs > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>سرعة الاستجابة (Latency):</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-700">{status.latencyMs} ms</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>آخر مزامنة ناجحة:</span>
                </span>
                <span className="text-slate-700">
                  {status.lastSyncedAt ? formatArabicDateTime(status.lastSyncedAt) : 'الآن'}
                </span>
              </div>

              {status.pendingOutboxCount > 0 && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                  <strong>تنبيه:</strong> توجد {status.pendingOutboxCount} عمليات تم حفظها محلياً أثناء انقطاع الاتصال وستُرسل تلقائياً.
                </div>
              )}
            </div>

            {/* Test result notice */}
            {testResult && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold">
                {testResult}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isManualSyncing}
                className="flex-1 py-2 px-3 rounded-xl bg-[#284d57] hover:bg-[#1c353d] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{isManualSyncing ? 'جارٍ الفحص والمزامنة...' : 'مزامنة وتحديث فوري الآن'}</span>
              </button>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setPopoverOpen(false);
                    onOpenSettings();
                  }}
                  className="py-2 px-3 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3] border border-[#dde6ed] text-[#1c353d] font-bold text-xs flex items-center gap-1 transition-colors"
                  title="إعدادات قاعدة البيانات المركزية"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">الإعدادات</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
