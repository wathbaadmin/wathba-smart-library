import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Reservation, ReservationStatus } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatArabicDate, formatArabicDateTime } from '../../lib/dateUtils';
import { exportToExcel } from '../../lib/exportUtils';
import { Clock, CheckCircle, XCircle, Search, Filter, BookOpen, User, Download, Send } from 'lucide-react';
import { DirectCheckoutModal } from '../supervisor/DirectCheckoutModal';

export interface ReservationsManagerProps {
  initialFilter?: 'all' | 'pending' | 'ready_for_pickup' | 'fulfilled' | 'rejected';
}

export const ReservationsManager: React.FC<ReservationsManagerProps> = ({
  initialFilter = 'all',
}) => {
  const { reservations, books, copies, students, updateReservationStatus, checkoutBook } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [checkoutTarget, setCheckoutTarget] = useState<Reservation | null>(null);

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  const supervisorId = currentStaff?.id || 'staff-admin-1';

  const filteredReservations = reservations.filter((res) => {
    const student = students.find((s) => s.id === res.studentId);
    const book = books.find((b) => b.id === res.bookId);

    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      (student && student.fullName.toLowerCase().includes(term)) ||
      (student && student.internalId.toLowerCase().includes(term)) ||
      (book && book.title.toLowerCase().includes(term));

    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pending'
        ? res.status === 'new_request' || res.status === 'pending_approval'
        : res.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const handleApproveAndPrepare = (res: Reservation) => {
    // إيجاد نسخة متاحة للكتاب لتخصيصها
    const availableCopy = copies.find(
      (c) => c.bookId === res.bookId && c.status === 'available'
    );

    updateReservationStatus(res.id, 'ready_for_pickup', supervisorId, availableCopy?.id);
    showToast('تمت الموافقة على طلب الحجز وتجهيزه للاستلام بنجاح!', 'success');
  };

  const handleReject = (res: Reservation) => {
    if (window.confirm('هل تريد رفض طلب الحجز هذا؟')) {
      updateReservationStatus(res.id, 'rejected', supervisorId);
      showToast('تم رفض طلب الحجز', 'info');
    }
  };

  const handleExportExcel = () => {
    const data = filteredReservations.map((r) => {
      const s = students.find((st) => st.id === r.studentId);
      const b = books.find((bk) => bk.id === r.bookId);
      const c = copies.find((cp) => cp.id === r.assignedCopyId);
      return {
        'رقم الحجز': r.id,
        'اسم الطالب': s?.fullName || '-',
        'الصف': s?.grade || '-',
        'المجموعة': s?.groupName || '-',
        'عنوان الكتاب': b?.title || '-',
        'النسخة المخصصة': c?.copyCode || 'لم تخصص بعد',
        'تاريخ الطلب': formatArabicDateTime(r.requestedAt),
        'حالة الحجز': r.status,
      };
    });
    exportToExcel(data, 'سجل_طلبات_حجز_الكتب');
    showToast('تم تصدير كشف الحجوزات إلى Excel', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Clock className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              إدارة طلبات الحجز والتجهيز المسبق
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            متابعة طلبات حجز الكتب المقدمة من الطلاب، مراجعتها، تجهيز النسخ على رف الاستلام، وتوثيق التسليم الميداني.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<Download className="w-4 h-4" />}
          onClick={handleExportExcel}
        >
          تصدير كشف الحجوزات (Excel)
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs">
        {[
          { id: 'all', label: 'جميع الحجوزات' },
          { id: 'pending', label: 'بانتظار الموافقة' },
          { id: 'ready_for_pickup', label: 'جاهز للاستلام 📚' },
          { id: 'fulfilled', label: 'تم التسليم' },
          { id: 'rejected', label: 'مرفوضة / ملغاة' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-xl font-bold transition-all shrink-0 ${
              statusFilter === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم الطالب، رقمه الداخلي، أو عنوان الكتاب..."
            className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
          />
        </div>
        <span className="text-[#3b707d] font-black bg-[#e3ecf3]/60 px-3 py-1.5 rounded-xl">
          {filteredReservations.length} طلب
        </span>
      </div>

      {/* Mobile Reservations Cards */}
      <div className="md:hidden space-y-3">
        {filteredReservations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#e3ecf3] p-10 text-center text-slate-400 text-xs shadow-soft">
            لا توجد طلبات حجز مطابقة
          </div>
        ) : (
          filteredReservations.map((res) => {
            const student = students.find((s) => s.id === res.studentId);
            const book = books.find((b) => b.id === res.bookId);
            const assignedCopy = copies.find((c) => c.id === res.assignedCopyId);
            const isPending = res.status === 'new_request' || res.status === 'pending_approval';
            const isReady = res.status === 'ready_for_pickup';

            return (
              <div
                key={res.id}
                className="bg-white rounded-2xl border border-[#e3ecf3] p-4 shadow-soft space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-sm text-slate-900 truncate">{student?.fullName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {student?.grade} • {student?.groupName}
                    </div>
                  </div>
                  <Badge status={res.status} size="sm" />
                </div>

                <div className="bg-[#f6f8fa] rounded-xl p-3 border border-[#e3ecf3]/70 space-y-1.5 text-xs">
                  <div className="font-bold text-slate-900">{book?.title}</div>
                  {assignedCopy && (
                    <div className="font-mono text-[11px] text-emerald-700 font-bold">
                      نسخة مخصصة: {assignedCopy.copyCode}
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-slate-500">
                    تاريخ الطلب: {formatArabicDateTime(res.requestedAt)}
                  </div>
                </div>

                {(isPending || isReady) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                    {isPending && (
                      <>
                        <Button
                          variant="primary"
                          size="md"
                          icon={<CheckCircle className="w-4 h-4" />}
                          onClick={() => handleApproveAndPrepare(res)}
                          className="flex-1"
                        >
                          موافقة وتجهيز
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleReject(res)}
                          className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                          title="رفض الطلب"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>رفض</span>
                        </button>
                      </>
                    )}
                    {isReady && (
                      <Button
                        variant="gold"
                        size="md"
                        icon={<Send className="w-4 h-4 text-slate-900" />}
                        onClick={() => setCheckoutTarget(res)}
                        className="w-full"
                      >
                        تسليم الآن
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Reservations Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#e3ecf3] overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#f6f8fa] text-slate-700 font-bold border-b border-[#e3ecf3]">
              <tr>
                <th className="p-4">الطالب</th>
                <th className="p-4">الصف والمجموعة</th>
                <th className="p-4">الكتاب المحجوز</th>
                <th className="p-4">تاريخ الطلب</th>
                <th className="p-4">حالة الحجز</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    لا توجد طلبات حجز مطابقة
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res) => {
                  const student = students.find((s) => s.id === res.studentId);
                  const book = books.find((b) => b.id === res.bookId);
                  const assignedCopy = copies.find((c) => c.id === res.assignedCopyId);
                  const isPending = res.status === 'new_request' || res.status === 'pending_approval';
                  const isReady = res.status === 'ready_for_pickup';

                  return (
                    <tr key={res.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{student?.fullName}</div>
                        <span className="font-mono text-slate-400 text-[11px]">{student?.internalId}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-slate-700">{student?.grade}</span>
                        <span className="text-slate-400 block text-[11px]">{student?.groupName}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{book?.title}</div>
                        {assignedCopy && (
                          <span className="font-mono text-[10px] text-emerald-700 font-bold block mt-0.5">
                            نسخة مخصصة: {assignedCopy.copyCode}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[11px]">
                        {formatArabicDateTime(res.requestedAt)}
                      </td>
                      <td className="p-4">
                        <Badge status={res.status} size="sm" />
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isPending && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                icon={<CheckCircle className="w-3.5 h-3.5" />}
                                onClick={() => handleApproveAndPrepare(res)}
                              >
                                موافقة وتجهيز
                              </Button>
                              <button
                                onClick={() => handleReject(res)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="رفض الطلب"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {isReady && (
                            <Button
                              variant="gold"
                              size="sm"
                              icon={<Send className="w-3.5 h-3.5 text-slate-900" />}
                              onClick={() => setCheckoutTarget(res)}
                            >
                              تسليم الآن
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Direct Checkout Modal triggered from ready reservations */}
      {checkoutTarget && (
        <DirectCheckoutModal
          isOpen={!!checkoutTarget}
          onClose={() => setCheckoutTarget(null)}
          supervisorId={supervisorId}
          preSelectedStudent={students.find((s) => s.id === checkoutTarget.studentId)}
          preSelectedCopy={copies.find((c) => c.id === checkoutTarget.assignedCopyId)}
        />
      )}
    </div>
  );
};
