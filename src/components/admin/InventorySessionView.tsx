import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { InventorySession, BookCopy, Book } from '../../types';
import { StatCard } from '../common/StatCard';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { QRScannerModal } from '../qr/QRScannerModal';
import { formatArabicDateTime } from '../../lib/dateUtils';
import { printDirectReport, exportToExcel } from '../../lib/exportUtils';
import {
  ClipboardCheck,
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  Printer,
  Download,
} from 'lucide-react';

interface InventorySessionViewProps {
  session: InventorySession;
  onBack: () => void;
}

export const InventorySessionView: React.FC<InventorySessionViewProps> = ({ session, onBack }) => {
  const { copies, books, inventoryScans, recordInventoryScan, completeInventorySession } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  const [inputCode, setInputCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'scanned' | 'missing' | 'borrowed'>('all');

  const sessionScans = inventoryScans.filter((s) => s.sessionId === session.id);
  const scannedCopyIds = new Set(sessionScans.map((s) => s.copyId).filter(Boolean));

  // تصنيف النسخ للمقارنة
  const foundOnShelfCopies = copies.filter((c) => scannedCopyIds.has(c.id));
  const borrowedCopies = copies.filter((c) => c.status === 'borrowed');
  const maintenanceCopies = copies.filter((c) => c.status === 'maintenance');
  const missingUnscannedCopies = copies.filter(
    (c) => !scannedCopyIds.has(c.id) && c.status !== 'borrowed' && c.status !== 'maintenance'
  );

  const supervisorId = currentStaff?.id || session.supervisorId;

  const handleScanCode = (code: string) => {
    if (!code.trim()) return;
    const res = recordInventoryScan(session.id, code.trim(), supervisorId);
    if (res.success) {
      showToast(res.message, res.result === 'unknown_code' ? 'warning' : 'success');
      setInputCode('');
    }
  };

  const handleFinishSession = () => {
    if (window.confirm('هل تريد اعتماد وإغلاق جلسة الجرد الحالية وتثبيت التقرير النهائي؟')) {
      completeInventorySession(session.id, 'تم إغلاق الجرد واعتماد مطابقة الرفوف');
      showToast('تم اعتماد جلسة الجرد بنجاح!', 'success');
      onBack();
    }
  };

  const handlePrintReport = () => {
    let rowsHtml = '';
    copies.forEach((c, idx) => {
      const b = books.find((bk) => bk.id === c.bookId);
      const isScanned = scannedCopyIds.has(c.id);
      let statusLabel = 'تم العثور عليها على الرف';
      if (!isScanned) {
        if (c.status === 'borrowed') statusLabel = 'مستعارة مع طالب (موثقة)';
        else if (c.status === 'maintenance') statusLabel = 'تحت الصيانة والتجليد';
        else statusLabel = 'لم يتم العثور عليها (مفقود محتمل)';
      }

      rowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${b?.title}</strong></td>
          <td><code>${c.copyCode}</code></td>
          <td>${c.shelfLocation}</td>
          <td>${statusLabel}</td>
        </tr>
      `;
    });

    const content = `
      <div style="margin-bottom: 16px;">
        <strong>جلسة الجرد:</strong> ${session.title}<br>
        <strong>تاريخ البدء:</strong> ${formatArabicDateTime(session.startedAt)}<br>
        <strong>المشرف المسؤول:</strong> ${currentStaff?.fullName || 'مشرف المكتبة'}
      </div>
      <div style="display: flex; gap: 16px; margin-bottom: 20px;">
        <div>إجمالي النسخ المتوقعة: <strong>${copies.length}</strong></div>
        <div>تم مسحها على الرف: <strong>${foundOnShelfCopies.length}</strong></div>
        <div>مستعارة موثقة: <strong>${borrowedCopies.length}</strong></div>
        <div>غير موجودة على الرف: <strong>${missingUnscannedCopies.length}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>عنوان الكتاب</th>
            <th>رمز النسخة</th>
            <th>الرف المسجل</th>
            <th>نتيجة الجرد</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    printDirectReport(`تقرير_جرد_${session.title}`, content);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-wathba-700 font-bold flex items-center gap-1 hover:underline mb-2"
          >
            <ArrowRight className="w-4 h-4" /> العودة لقائمة جلسات الجرد
          </button>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">{session.title}</h2>
            <Badge status={session.status} />
          </div>
          <span className="text-xs text-slate-400 block mt-1">
            بدأت في: {formatArabicDateTime(session.startedAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="royal"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrintReport}
          >
            طباعة تقرير الجرد
          </Button>
          {session.status === 'active' && (
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={handleFinishSession}
            >
              اعتماد وإغلاق الجلسة
            </Button>
          )}
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="إجمالي النسخ المتوقعة"
          value={copies.length}
          subtitle="المسجلة في النظام"
          icon={<ClipboardCheck className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="تم العثور عليها على الرف"
          value={foundOnShelfCopies.length}
          subtitle="تم مسحها وتأكيدها"
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="مستعارة موثقة مع الطلاب"
          value={borrowedCopies.length}
          subtitle="لا يتوقع وجودها على الرف"
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="لم يتم العثور عليها (مفقود محتمل)"
          value={missingUnscannedCopies.length}
          subtitle="تحتاج تتبع ومراجعة"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="rose"
        />
      </div>

      {/* Live Scan Input Panel (Only if active) */}
      {session.status === 'active' && (
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-premium flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-right">
            <h3 className="font-bold text-base text-white">مسح الرفوف والمقارنة الحية</h3>
            <p className="text-xs text-slate-400">
              امسح رمز QR لأي نسخة مباشرة، وسيقوم النظام فوراً بتوثيق وجودها على الرف ومطابقتها.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleScanCode(inputCode);
              }}
              placeholder="اكتب رمز النسخة مثل WTH-125-001 واضغط Enter..."
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-white border border-slate-700 text-xs font-mono text-center focus:ring-2 focus:ring-wathba-400 focus:outline-none min-w-[260px]"
            />
            <Button
              variant="gold"
              size="md"
              icon={<Camera className="w-4 h-4 text-slate-900" />}
              onClick={() => setScannerOpen(true)}
            >
              الكاميرا
            </Button>
          </div>
        </div>
      )}

      {/* Comparison Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          جميع النسخ ({copies.length})
        </button>
        <button
          onClick={() => setActiveTab('scanned')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'scanned' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          تم العثور عليها ({foundOnShelfCopies.length})
        </button>
        <button
          onClick={() => setActiveTab('borrowed')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'borrowed' ? 'bg-royal-600 text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          مستعارة موثقة ({borrowedCopies.length})
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'missing' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
          }`}
        >
          لم يتم العثور عليها ({missingUnscannedCopies.length})
        </button>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">الكتاب</th>
                <th className="p-4">رمز النسخة</th>
                <th className="p-4">الرف المسجل</th>
                <th className="p-4">حالة النظام</th>
                <th className="p-4">نتيجة الجرد الميداني</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(activeTab === 'all'
                ? copies
                : activeTab === 'scanned'
                ? foundOnShelfCopies
                : activeTab === 'borrowed'
                ? borrowedCopies
                : missingUnscannedCopies
              ).map((copy) => {
                const b = books.find((bk) => bk.id === copy.bookId);
                const isScanned = scannedCopyIds.has(copy.id);

                return (
                  <tr key={copy.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-900">{b?.title}</td>
                    <td className="p-4 font-mono font-bold text-slate-700">{copy.copyCode}</td>
                    <td className="p-4 text-slate-500">{copy.shelfLocation}</td>
                    <td className="p-4">
                      <Badge status={copy.status} size="sm" />
                    </td>
                    <td className="p-4">
                      {isScanned ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تم العثور عليها على الرف
                        </span>
                      ) : copy.status === 'borrowed' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px]">
                          مستعارة مع طالب
                        </span>
                      ) : copy.status === 'maintenance' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 font-bold text-[11px]">
                          تحت الصيانة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          لم تُمسح بعد
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          initialMode="inquiry"
          onScanSuccess={(code) => handleScanCode(code)}
        />
      )}
    </div>
  );
};
