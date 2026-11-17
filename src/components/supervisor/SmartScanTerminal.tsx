import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { BookCopy, Student, Book, Loan } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { QRScannerModal } from '../qr/QRScannerModal';
import { DirectCheckoutModal } from './DirectCheckoutModal';
import { DirectReturnModal } from './DirectReturnModal';
import { InspectionHistoryModal } from '../inspection/InspectionHistoryModal';
import {
  QrCode,
  Camera,
  Search,
  BookOpen,
  User,
  CheckCircle,
  RotateCcw,
  History,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatArabicDate, isOverdue } from '../../lib/dateUtils';

export const SmartScanTerminal: React.FC = () => {
  const { copies, books, students, loans, conditionReports } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  const [activeMode, setActiveMode] = useState<'checkout' | 'return' | 'inquiry'>('inquiry');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  // Entities matched from scan
  const [matchedCopy, setMatchedCopy] = useState<BookCopy | null>(null);
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);

  // Action modals
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // معالجة نتيجة المسح بالكاميرا أو الإدخال اليدوي
  const handleProcessCode = (code: string, mode?: 'checkout' | 'return' | 'inquiry') => {
    const trimmed = code.trim();
    setScannedResult(trimmed);

    // البحث هل الرمز يخص طالب أم نسخة كتاب؟
    const foundStudent = students.find(
      (s) => s.qrToken === trimmed || s.internalId.toLowerCase() === trimmed.toLowerCase()
    );

    const foundCopy = copies.find(
      (c) =>
        c.copyCode.toLowerCase() === trimmed.toLowerCase() ||
        c.qrData.toLowerCase() === trimmed.toLowerCase()
    );

    if (foundStudent) {
      setMatchedStudent(foundStudent);
      setMatchedCopy(null);
      setActiveLoan(null);
      showToast(`تم التعرف على الطالب: ${foundStudent.fullName}`, 'success');
      if (mode === 'checkout' || activeMode === 'checkout') {
        setCheckoutModalOpen(true);
      }
    } else if (foundCopy) {
      setMatchedCopy(foundCopy);
      setMatchedStudent(null);

      // البحث عن إعارة نشطة لهذه النسخة
      const loan = loans.find((l) => l.copyId === foundCopy.id && l.status === 'active');
      setActiveLoan(loan || null);

      if (loan) {
        const student = students.find((s) => s.id === loan.studentId);
        if (student) setMatchedStudent(student);
      }

      showToast(`تم التعرف على النسخة: ${foundCopy.copyCode}`, 'success');

      if (mode === 'return' || activeMode === 'return') {
        setReturnModalOpen(true);
      } else if (mode === 'checkout' || activeMode === 'checkout') {
        setCheckoutModalOpen(true);
      }
    } else {
      setMatchedStudent(null);
      setMatchedCopy(null);
      setActiveLoan(null);
      showToast('الرمز الممسوح غير مسجل في قاعدة البيانات', 'error');
    }
  };

  const matchedBook = matchedCopy ? books.find((b) => b.id === matchedCopy.bookId) : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Terminal Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-slate-900 via-wathba-950 to-slate-900 text-white shadow-premium border border-slate-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <QrCode className="w-3.5 h-3.5" />
              <span>شاشة المسح الذكي الفوري • Smart Scan Terminal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              بوابة المشرف للتعامل الميداني المباشر
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              وجّه كاميرا الجوال أو قارئ الباركود نحو ملصق الكتاب أو بطاقة الطالب لتنفيذ الإجراء فوراً دون الحاجة لكتابة أو بحث طويل.
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-3 w-full md:w-auto">
            <Button
              variant="gold"
              size="lg"
              icon={<Camera className="w-5 h-5 text-slate-900" />}
              onClick={() => setScannerOpen(true)}
              className="w-full md:w-auto shadow-card hover:scale-102"
            >
              تشغيل كاميرا المسح الذكي 📷
            </Button>
            <span className="text-[11px] text-slate-400">تدعم جميع الهواتف الذكية والأجهزة اللوحية</span>
          </div>
        </div>

        {/* 3 Modes Switcher */}
        <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setActiveMode('checkout')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 ${
              activeMode === 'checkout'
                ? 'bg-wathba-600/40 border-wathba-500 text-white shadow-soft ring-1 ring-wathba-400'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-wathba-500 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs block text-white">1. وضع تسليم كتاب</span>
              <span className="text-[10px] text-slate-400">مسح بطاقة الطالب ثم نسخة الكتاب</span>
            </div>
          </button>

          <button
            onClick={() => setActiveMode('return')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 ${
              activeMode === 'return'
                ? 'bg-royal-600/40 border-royal-500 text-white shadow-soft ring-1 ring-royal-400'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-royal-500 text-white">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs block text-white">2. وضع استرجاع كتاب</span>
              <span className="text-[10px] text-slate-400">مسح ملصق الكتاب وفحص حالته</span>
            </div>
          </button>

          <button
            onClick={() => setActiveMode('inquiry')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 ${
              activeMode === 'inquiry'
                ? 'bg-amber-600/40 border-amber-500 text-white shadow-soft ring-1 ring-amber-400'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-amber-500 text-white">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs block text-white">3. وضع الاستعلام الشامل</span>
              <span className="text-[10px] text-slate-400">فحص بيانات أي رمز فوري</span>
            </div>
          </button>
        </div>
      </div>

      {/* Manual Quick Entry Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            placeholder="أو اكتب رمز النسخة (مثل WTH-125-001) أو رمز الطالب (STU-1001) واضغط Enter..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                handleProcessCode((e.target as HTMLInputElement).value.trim(), activeMode);
              }
            }}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-wathba-500 font-mono text-right"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleProcessCode('WTH-125-001', activeMode)}
            className="text-xs"
          >
            تجربة نسخة 125-001
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleProcessCode('STU-1001', activeMode)}
            className="text-xs"
          >
            تجربة طالب 1001
          </Button>
        </div>
      </div>

      {/* Dynamic Scanned Result Card */}
      {matchedStudent && (
        <div className="p-6 rounded-3xl bg-white border border-emerald-200 shadow-soft space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <User className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  بطاقة طالب معتمد
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  {matchedStudent.fullName}
                </h3>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
              {matchedStudent.internalId}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">الصف والمرحلة</span>
              <span className="font-bold text-slate-800">{matchedStudent.grade} ({matchedStudent.stage})</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">المجموعة</span>
              <span className="font-bold text-slate-800">{matchedStudent.groupName}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">الكتب المستعارة حالياً</span>
              <span className="font-bold text-emerald-700">{matchedStudent.currentActiveLoans} من 2</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[10px]">إجمالي الكتب المقروءة</span>
              <span className="font-bold text-slate-800">{matchedStudent.totalBooksRead} كتب</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="primary"
              size="md"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={() => setCheckoutModalOpen(true)}
            >
              تسليم كتاب لهذا الطالب الآن
            </Button>
          </div>
        </div>
      )}

      {matchedCopy && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-22 rounded-2xl bg-gradient-to-tr from-wathba-800 to-emerald-600 text-gold-300 flex items-center justify-center shadow-xs shrink-0">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1 text-right">
                <span className="text-[10px] font-bold text-royal-700 bg-royal-50 px-2 py-0.5 rounded-md border border-royal-200">
                  بيانات النسخة الورقية
                </span>
                <h3 className="text-lg font-black text-slate-900 leading-snug">
                  {matchedBook?.title}
                </h3>
                <div className="text-xs text-slate-500">
                  رمز النسخة: <strong className="font-mono text-slate-800">{matchedCopy.copyCode}</strong>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge status={matchedCopy.status} />
                  <Badge status={matchedCopy.condition} />
                  <span className="text-xs text-slate-500">الموقع: {matchedCopy.shelfLocation}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="secondary"
                size="sm"
                icon={<History className="w-4 h-4" />}
                onClick={() => setHistoryModalOpen(true)}
              >
                سجل الفحص للكتاب
              </Button>
            </div>
          </div>

          {/* Active Loan Details if Borrowed */}
          {activeLoan && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  هذه النسخة مستعارة حالياً
                </span>
                <span className="font-bold text-amber-900">
                  موعد الإرجاع: {formatArabicDate(activeLoan.dueDate)}
                </span>
              </div>
              <div className="text-slate-700">
                الطالب المستعير: <strong>{matchedStudent?.fullName}</strong> ({matchedStudent?.grade} - {matchedStudent?.groupName})
              </div>
            </div>
          )}

          {/* Action triggers */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {matchedCopy.status === 'borrowed' ? (
              <Button
                variant="royal"
                size="md"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={() => setReturnModalOpen(true)}
              >
                استرجاع هذه النسخة وفحصها
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                icon={<CheckCircle className="w-4 h-4" />}
                onClick={() => setCheckoutModalOpen(true)}
              >
                تسليم هذه النسخة لطالب
              </Button>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          initialMode={activeMode}
          onScanSuccess={(code, mode) => {
            setActiveMode(mode);
            handleProcessCode(code, mode);
          }}
        />
      )}

      {/* Checkout Modal */}
      {checkoutModalOpen && currentStaff && (
        <DirectCheckoutModal
          isOpen={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          supervisorId={currentStaff.id}
          preSelectedStudent={matchedStudent || undefined}
          preSelectedCopy={matchedCopy || undefined}
        />
      )}

      {/* Return Modal */}
      {returnModalOpen && currentStaff && (
        <DirectReturnModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          supervisorId={currentStaff.id}
          preSelectedLoanId={activeLoan?.id}
          preSelectedCopyCode={matchedCopy?.copyCode}
        />
      )}

      {/* Inspection History Modal */}
      {historyModalOpen && matchedCopy && (
        <InspectionHistoryModal
          isOpen={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          copy={matchedCopy}
          book={matchedBook || undefined}
          reports={conditionReports.filter((r) => r.copyId === matchedCopy.id)}
        />
      )}
    </div>
  );
};
