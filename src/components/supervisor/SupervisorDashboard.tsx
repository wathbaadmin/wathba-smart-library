import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../common/StatCard';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { DirectCheckoutModal } from './DirectCheckoutModal';
import { DirectReturnModal } from './DirectReturnModal';
import { formatArabicDate, isOverdue } from '../../lib/dateUtils';
import {
  BookOpen,
  Clock,
  CheckCircle,
  AlertCircle,
  QrCode,
  RotateCcw,
  Search,
  Users,
  Layers,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface SupervisorDashboardProps {
  onNavigateToScan?: () => void;
  onNavigateToDistribution?: () => void;
  onNavigateToShelf?: () => void;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  onNavigateToScan,
  onNavigateToDistribution,
  onNavigateToShelf,
}) => {
  const { loans, reservations, copies, books, students, updateReservationStatus } = useLibrary();
  const { currentStaff } = useAuth();

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  // إحصائيات المشرف
  const activeLoans = loans.filter((l) => l.status === 'active');
  const overdueLoans = activeLoans.filter((l) => isOverdue(l.dueDate));
  const newReservations = reservations.filter((r) => r.status === 'new_request' || r.status === 'pending_approval');
  const readyReservations = reservations.filter((r) => r.status === 'ready_for_pickup');
  const inspectionCopies = copies.filter((c) => c.status === 'under_inspection');

  const supervisorId = currentStaff?.id || 'staff-supervisor-1';

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-royal-900 via-royal-800 to-royal-950 text-white shadow-soft flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center md:text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-royal-700/60 text-royal-200 text-xs font-bold border border-royal-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>لوحة المشرف الميداني المعتمد</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            مرحباً {currentStaff?.fullName || 'مشرف المكتبة'}
          </h1>
          <p className="text-xs sm:text-sm text-royal-100/80 leading-relaxed max-w-xl">
            متابعة فورية لجميع عمليات الإعارة، المسح الذكي لرموز الكتب، استرجاع النسخ، وتوثيق الفحص لضمان سلامة مقتنيات وثبة.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0">
          <Button
            variant="gold"
            size="md"
            icon={<QrCode className="w-4 h-4 text-slate-900" />}
            onClick={onNavigateToScan}
          >
            المسح الذكي بالكاميرا
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<BookOpen className="w-4 h-4" />}
            onClick={() => setCheckoutModalOpen(true)}
          >
            تسليم كتاب
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => setReturnModalOpen(true)}
          >
            استرجاع كتاب
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="الإعارات النشطة"
          value={activeLoans.length}
          subtitle="مع الطلاب حالياً"
          icon={<BookOpen className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="الحجوزات الجديدة"
          value={newReservations.length}
          subtitle="بانتظار الموافقة"
          icon={<Clock className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="جاهز للتسليم"
          value={readyReservations.length}
          subtitle="محجوزة ومجهزة"
          icon={<CheckCircle className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="كتب متأخرة"
          value={overdueLoans.length}
          subtitle="تجاوزت موعد الإرجاع"
          icon={<AlertCircle className="w-5 h-5" />}
          color="rose"
        />
        <StatCard
          title="على رف الإرجاع"
          value={inspectionCopies.length}
          subtitle="تنتظر اعتماد الفحص"
          icon={<Layers className="w-5 h-5" />}
          color="purple"
          onClick={onNavigateToShelf}
        />
      </div>

      {/* Content Split: Pending Reservations & Overdue Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Reservations Panel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">الحجوزات الجديدة والطلبات</h3>
            </div>
            <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
              {newReservations.length} طلب
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {newReservations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا توجد طلبات حجز جديدة بانتظار الموافقة
              </div>
            ) : (
              newReservations.map((res) => {
                const student = students.find((s) => s.id === res.studentId);
                const book = books.find((b) => b.id === res.bookId);

                return (
                  <div
                    key={res.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{book?.title}</h4>
                      <span className="text-slate-500 block mt-0.5">
                        الطالب: <strong>{student?.fullName}</strong> ({student?.grade} - {student?.groupName})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => updateReservationStatus(res.id, 'ready_for_pickup', supervisorId)}
                      >
                        موافقة وتجهيز
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateReservationStatus(res.id, 'rejected', supervisorId)}
                      >
                        رفض
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Overdue Loans Panel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-800">متابعة الكتب المتأخرة عن الإرجاع</h3>
            </div>
            <span className="text-xs text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded-full">
              {overdueLoans.length} متأخر
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {overdueLoans.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                ممتاز! لا توجد كتب متأخرة عن موعد الإرجاع حالياً 🌟
              </div>
            ) : (
              overdueLoans.map((loan) => {
                const copy = copies.find((c) => c.id === loan.copyId);
                const book = books.find((b) => b.id === copy?.bookId);
                const student = students.find((s) => s.id === loan.studentId);

                return (
                  <div
                    key={loan.id}
                    className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{book?.title}</h4>
                      <span className="text-slate-600 block mt-0.5">
                        مع الطالب: <strong>{student?.fullName}</strong> ({student?.grade} - {student?.groupName})
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        النسخة: {copy?.copyCode} • استحقاق: {formatArabicDate(loan.dueDate)}
                      </span>
                    </div>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setReturnModalOpen(true)}
                    >
                      استرجاع الآن
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {checkoutModalOpen && (
        <DirectCheckoutModal
          isOpen={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          supervisorId={supervisorId}
        />
      )}

      {returnModalOpen && (
        <DirectReturnModal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          supervisorId={supervisorId}
        />
      )}
    </div>
  );
};
