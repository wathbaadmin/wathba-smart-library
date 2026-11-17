import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { formatArabicDateTime } from '../../lib/dateUtils';
import { History, Search, ShieldCheck, Clock, FileSpreadsheet } from 'lucide-react';
import { Button } from '../common/Button';
import { exportToExcel } from '../../lib/exportUtils';

export const AuditLogViewer: React.FC = () => {
  const { auditLogs } = useLibrary();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.actorName.toLowerCase().includes(term) ||
      (log.notes && log.notes.toLowerCase().includes(term))
    );
  });

  const handleExportExcel = () => {
    const data = auditLogs.map((l) => ({
      'المعرف': l.id,
      'الوقت والتاريخ': formatArabicDateTime(l.createdAt),
      'منفذ العملية': l.actorName,
      'نوع المنفذ': l.actorType,
      'العملية': l.action,
      'الكيان': l.entityType,
      'الملاحظات': l.notes || '-',
    }));
    exportToExcel(data, 'سجل_تدقيق_عمليات_المكتبة');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <History className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              سجل التدقيق والعمليات الشامل (Audit Log)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            سجل غير قابل للحذف يحفظ كل حركة تسليم، استرجاع، تعديل بيانات، تغيير صلاحيات، أو تحديث بالإعدادات مع اسم المنفذ والوقت الدقيق بتوقيت الرياض.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<FileSpreadsheet className="w-4 h-4" />}
          onClick={handleExportExcel}
        >
          تصدير السجل Excel
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم المشرف، نوع العملية (تسليم كتاب، استرجاع)، أو التفاصيل..."
            className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-wathba-500 focus:outline-none"
          />
        </div>
        <span className="text-slate-400 font-bold">
          {filteredLogs.length} سجل موثق
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
        <div className="overflow-x-auto max-h-[550px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-4">منفذ العملية</th>
                <th className="p-4">نوع الإجراء</th>
                <th className="p-4">الكيان والهدف</th>
                <th className="p-4">التفاصيل والملاحظات</th>
                <th className="p-4">الوقت والتاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    لا توجد عمليات مطابقة في السجل
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{log.actorName}</div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {log.actorType}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-600">
                      {log.entityType} {log.entityId ? `(#${log.entityId})` : ''}
                    </td>
                    <td className="p-4 text-slate-700 max-w-xs leading-relaxed">
                      {log.notes || '-'}
                    </td>
                    <td className="p-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatArabicDateTime(log.createdAt)}</span>
                      </div>
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
