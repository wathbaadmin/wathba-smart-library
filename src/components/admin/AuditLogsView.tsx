import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../common/Button';
import { formatArabicDate } from '../../lib/dateUtils';
import {
  History,
  Search,
  Filter,
  Download,
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  Calendar,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const { auditLogs } = useLibrary();
  const { showToast } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterActorType, setFilterActorType] = useState<string>('all');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');

  // Filter logic
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesActor = filterActorType === 'all' || log.actorType === filterActorType;
    const matchesEntity = filterEntityType === 'all' || log.entityType === filterEntityType;

    return matchesSearch && matchesActor && matchesEntity;
  });

  const exportLogsAsCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('لا توجد سجلات لتصديرها', 'warning');
      return;
    }

    const headers = ['المعرف', 'المشغل/المستخدم', 'نوع الحساب', 'العملية', 'الكيان', 'معرف السجل', 'التاريخ والوقت'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.actorName}"`,
      l.actorType,
      `"${l.action}"`,
      l.entityType,
      l.entityId || '-',
      `"${l.createdAt}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `wathba_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('تم تصدير سجل العمليات بصيغة CSV بنجاح 📊', 'success');
  };

  const getActorBadge = (actorType: string) => {
    switch (actorType) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-wathba-100 text-wathba-800 border border-wathba-200">
            <ShieldCheck className="w-3.5 h-3.5 text-wathba-700" />
            <span>إدارة عليا</span>
          </span>
        );
      case 'supervisor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>مشرف ميداني</span>
          </span>
        );
      case 'student':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <User className="w-3.5 h-3.5 text-amber-600" />
            <span>طالب</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            <span>نظام تلقائي</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-wathba-100 text-wathba-700">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-900">سجل العمليات والرقابة الشاملة</h2>
          </div>
          <p className="text-xs text-slate-500">
            تتبع أمني غير قابل للتعديل لكافة حركات الإعارة، الإرجاع، تعديل الكتب، وتغيير السياسات.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Download className="w-4 h-4" />}
          onClick={exportLogsAsCSV}
          className="text-xs font-bold whitespace-nowrap shadow-soft"
        >
          تصدير السجل الكامل (CSV)
        </Button>
      </div>

      {/* Security Guarantee Banner */}
      <div className="p-4 rounded-3xl bg-slate-900 text-slate-200 border border-slate-800 flex items-center justify-between gap-3 text-xs shadow-soft">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span>
            سجل العمليات محمي ومؤمن برمجياً وقاعدياً، ويمنع منعاً باتاً تعديل أو حذف أي مدخل أمني.
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-400 hidden sm:inline-block">
          إجمالي الحركات: {auditLogs.length}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e3ecf3] shadow-soft flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالعملية، اسم المشرف، الكيان..."
            className="w-full min-h-[44px] pr-10 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full lg:w-auto">
          <Filter className="w-4 h-4 text-[#3b707d] shrink-0 hidden sm:block" />
          <select
            value={filterActorType}
            onChange={(e) => setFilterActorType(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
          >
            <option value="all">كل المشغلين</option>
            <option value="admin">الإدارة</option>
            <option value="supervisor">المشرفون</option>
            <option value="student">الطلاب</option>
            <option value="system">النظام</option>
          </select>

          <select
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
          >
            <option value="all">كل الكيانات</option>
            <option value="loan">الإعارات</option>
            <option value="book">الكتب</option>
            <option value="book_copy">النسخ الورقية</option>
            <option value="discussion">المناقشات القرائية</option>
            <option value="discussion_group">المناقشات الجماعية</option>
            <option value="reading_log">سجلات القراءة</option>
            <option value="reading_certificate">الشهادات</option>
            <option value="reservation">الحجوزات</option>
            <option value="student">الطلاب</option>
            <option value="staff">المشرفون</option>
            <option value="library_settings">الإعدادات</option>
            <option value="discussion_settings">إعدادات المناقشات</option>
            <option value="report_settings">إعدادات التقارير</option>
            <option value="supervisor_notes">ملخصات وتوصيات التقارير</option>
          </select>
        </div>
      </div>

      {/* Mobile Audit Cards */}
      <div className="md:hidden space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#e3ecf3] p-10 text-center text-slate-400 text-xs shadow-soft">
            لا توجد حركات مسجلة تطابق محددات البحث
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white rounded-2xl border border-[#e3ecf3] p-4 shadow-soft space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-slate-900 truncate">{log.actorName}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{formatArabicDate(log.createdAt)}</div>
                </div>
                {getActorBadge(log.actorType)}
              </div>

              <div className="font-bold text-[#284d57] bg-[#f6f8fa] px-3 py-2 rounded-xl border border-[#e3ecf3]/70">
                {log.action}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono font-bold">
                  {log.entityType} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                </span>
                <span className="text-slate-500">
                  {log.reason || log.notes || 'عملية قياسية مسجلة بالنظام'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Audit Logs Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#e3ecf3] shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#f6f8fa] border-b border-[#e3ecf3] text-slate-600 font-black">
              <tr>
                <th className="p-4">الوقت والتاريخ</th>
                <th className="p-4">المشغل (الفاعل)</th>
                <th className="p-4">النوع</th>
                <th className="p-4">الإجراء المنفذ</th>
                <th className="p-4">الكيان المتأثر</th>
                <th className="p-4">التفاصيل / الملاحظة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    لا توجد حركات مسجلة تطابق محددات البحث
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                    <td className="p-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {formatArabicDate(log.createdAt)}
                    </td>
                    <td className="p-4 whitespace-nowrap font-bold text-slate-900">
                      {log.actorName}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {getActorBadge(log.actorType)}
                    </td>
                    <td className="p-4 font-bold text-[#284d57]">
                      {log.action}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono text-[11px] font-bold">
                        {log.entityType} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 text-[11px] max-w-xs truncate" title={log.reason || log.notes}>
                      {log.reason || log.notes || 'عملية قياسية مسجلة بالنظام'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
