import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Reservation, Student, Book, BookCopy } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Users, Printer, QrCode, CheckCircle, Search, Filter, Calendar } from 'lucide-react';
import { formatArabicDate } from '../../lib/dateUtils';
import { printDirectReport } from '../../lib/exportUtils';
import { QRScannerModal } from '../qr/QRScannerModal';

export const BulkDistributionView: React.FC = () => {
  const { reservations, students, books, copies, checkoutBook, updateReservationStatus } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeReservationForScan, setActiveReservationForScan] = useState<Reservation | null>(null);

  // الحجوزات القابلة للتوزيع الجماعي (المقبولة أو الجاهزة للاستلام)
  const distributableReservations = reservations.filter(
    (r) => r.status === 'approved' || r.status === 'ready_for_pickup' || r.status === 'preparing'
  );

  // استخراج الصفوف والمجموعات المميزة
  const uniqueGrades = Array.from(new Set(students.map((s) => s.grade)));
  const uniqueGroups = Array.from(new Set(students.map((s) => s.groupName)));

  // تطبيق التصفية
  const filteredList = distributableReservations.filter((res) => {
    const student = students.find((s) => s.id === res.studentId);
    if (!student) return false;

    const matchGrade = selectedGrade === 'all' || student.grade === selectedGrade;
    const matchGroup = selectedGroup === 'all' || student.groupName === selectedGroup;

    return matchGrade && matchGroup;
  });

  const handlePrintDistributionSheet = () => {
    let rowsHtml = '';
    filteredList.forEach((r, idx) => {
      const student = students.find((s) => s.id === r.studentId);
      const book = books.find((b) => b.id === r.bookId);
      const copy = copies.find((c) => c.id === r.assignedCopyId);

      rowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${student?.fullName}</strong> (${student?.internalId})</td>
          <td>${student?.grade} - ${student?.groupName}</td>
          <td>${book?.title}</td>
          <td><code>${copy?.copyCode || 'غير مخصص'}</code></td>
          <td style="width: 120px;">[ &nbsp; &nbsp; ] توقيع / استلام</td>
        </tr>
      `;
    });

    const content = `
      <div style="margin-bottom: 16px;">
        <strong>تصفية القائمة:</strong> الصف (${selectedGrade === 'all' ? 'جميع الصفوف' : selectedGrade}) • المجموعة (${selectedGroup === 'all' ? 'جميع المجموعات' : selectedGroup})
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">إجمالي الكتب في قائمة التوزيع: ${filteredList.length} كتاب</div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>اسم الطالب</th>
            <th>الصف والمجموعة</th>
            <th>الكتاب المطلوب</th>
            <th>رمز النسخة</th>
            <th>تأكيد الاستلام</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="text-align: center;">لا توجد طلبات توزيع مطابقة</td></tr>'}
        </tbody>
      </table>
    `;

    printDirectReport('قائمة التوزيع الجماعي لكتب وثبة', content);
  };

  const handleOpenScanForReservation = (reservation: Reservation) => {
    setActiveReservationForScan(reservation);
    setScannerOpen(true);
  };

  const handleDirectDeliverFromList = (reservation: Reservation) => {
    if (!currentStaff) return;

    // إيجاد نسخة متاحة للكتاب أو النسخة المخصصة مسبقاً
    const targetCopy = reservation.assignedCopyId
      ? copies.find((c) => c.id === reservation.assignedCopyId)
      : copies.find((c) => c.bookId === reservation.bookId && (c.status === 'available' || c.status === 'reserved'));

    if (!targetCopy) {
      showToast('لا توجد نسخة متاحة لهذا الكتاب للتسليم حالياً', 'error');
      return;
    }

    const res = checkoutBook({
      copyId: targetCopy.id,
      studentId: reservation.studentId,
      supervisorId: currentStaff.id,
      conditionRating: 'good',
      conditionNotes: 'تسليم موثق ضمن حملة التوزيع الجماعي',
    });

    if (res.success) {
      updateReservationStatus(reservation.id, 'fulfilled', currentStaff.id);
      showToast('تم توثيق تسليم الكتاب للطالب بنجاح!', 'success');
    } else {
      showToast(res.error || 'فشل التسليم', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              نظام التوزيع الجماعي (Bulk Distribution)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            تجهيز كتب الطلاب وتوزيعها على الفصول والمجموعات داخل مقر وثبة مع توثيق الاستلام الفعلي بالباركود والتاريخ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="royal"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrintDistributionSheet}
          >
            طباعة كشف التوزيع ورسمياً
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700">تصفية القائمة:</span>
        </div>

        <div className="flex items-center gap-2">
          <span>الصف:</span>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-wathba-500"
          >
            <option value="all">جميع الصفوف ({students.length})</option>
            {uniqueGrades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>المجموعة:</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-wathba-500"
          >
            <option value="all">جميع المجموعات</option>
            {uniqueGroups.map((grp) => (
              <option key={grp} value={grp}>
                {grp}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-400 mr-auto font-bold">
          {filteredList.length} طلب جاهز للتسليم
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">الطالب</th>
                <th className="p-4">الصف والمجموعة</th>
                <th className="p-4">الكتاب المحجوز</th>
                <th className="p-4">النسخة المقترحة</th>
                <th className="p-4">حالة الطلب</th>
                <th className="p-4 text-center">إجراء التسليم الفعلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    لا توجد طلبات حجز معتمدة بانتظار التوزيع الجماعي حالياً
                  </td>
                </tr>
              ) : (
                filteredList.map((res) => {
                  const student = students.find((s) => s.id === res.studentId);
                  const book = books.find((b) => b.id === res.bookId);
                  const assignedCopy = copies.find((c) => c.id === res.assignedCopyId);

                  return (
                    <tr key={res.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900">{student?.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{student?.internalId}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-slate-700">{student?.grade}</span>
                        <span className="text-slate-400 block text-[11px]">{student?.groupName}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{book?.title}</div>
                        <div className="text-[11px] text-slate-400">المؤلف: {book?.author}</div>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700">
                        {assignedCopy ? assignedCopy.copyCode : 'تخصيص تلقائي عند المسح'}
                      </td>
                      <td className="p-4">
                        <Badge status={res.status} size="sm" />
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<CheckCircle className="w-3.5 h-3.5" />}
                            onClick={() => handleDirectDeliverFromList(res)}
                          >
                            تأكيد الاستلام
                          </Button>
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

      {/* QR Scanner for Distribution */}
      {scannerOpen && (
        <QRScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          initialMode="checkout"
          onScanSuccess={(scannedText) => {
            if (activeReservationForScan) {
              handleDirectDeliverFromList(activeReservationForScan);
            }
          }}
        />
      )}
    </div>
  );
};
