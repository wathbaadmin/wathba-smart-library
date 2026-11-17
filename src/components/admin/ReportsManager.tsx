import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../common/Button';
import { GroupReportView } from '../reports/GroupReportView';
import { StudentIndividualReportView } from '../reports/StudentIndividualReportView';
import { exportToExcel, printDirectReport } from '../../lib/exportUtils';
import { downloadOfficialReportPdf } from '../../lib/reportExportUtils';
import { formatArabicDate, formatArabicDateTime, isOverdue } from '../../lib/dateUtils';
import {
  FileText,
  Printer,
  Download,
  Users,
  User,
  Layers,
} from 'lucide-react';

interface ReportsManagerProps {
  initialStudentId?: string;
  initialMainTab?: 'group' | 'student' | 'operational' | 'analytics';
  initialReportType?: string;
}

export const ReportsManager: React.FC<ReportsManagerProps> = ({
  initialStudentId,
  initialMainTab,
  initialReportType,
}) => {
  const {
    books,
    copies,
    categories,
    students,
    staff,
    loans,
    conditionReports,
    reportSettings,
    discussions,
    readingLogs,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [mainTab, setMainTab] = useState<'group' | 'student' | 'operational' | 'analytics'>(
    initialStudentId ? 'student' : initialMainTab || 'group'
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || students[0]?.id || ''
  );
  const [activeReportType, setActiveReportType] = useState<string>(initialReportType || 'all_books');
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      setMainTab('student');
    }
  }, [initialStudentId]);

  useEffect(() => {
    if (initialMainTab) {
      setMainTab(initialMainTab);
    }
  }, [initialMainTab]);

  useEffect(() => {
    if (initialReportType) {
      setActiveReportType(initialReportType);
    }
  }, [initialReportType]);

  const handleOpenStudentFromGroup = (stuId: string) => {
    setSelectedStudentId(stuId);
    setMainTab('student');
  };

  // توليد بيانات التقارير التشغيلية الـ 9 الأصلية
  const getReportPayload = () => {
    switch (activeReportType) {
      case 'all_books':
        return {
          title: 'تقرير جميع الكتب المسجلة بالفهرس',
          columns: ['رمز الكتاب', 'عنوان الكتاب', 'المؤلف', 'التصنيف', 'الصفحات', 'النسخ الإجمالية', 'النسخ المتاحة'],
          data: books.map((b) => {
            const cat = categories.find((c) => c.id === b.categoryId);
            return [b.code, b.title, b.author, cat?.name || '-', b.pageCount || '-', b.totalCopiesCount, b.availableCopiesCount];
          }),
        };

      case 'all_copies':
        return {
          title: 'تقرير النسخ الورقية وحالتها الميدانية',
          columns: ['رمز النسخة', 'عنوان الكتاب', 'الرف', 'الحالة', 'التقييم'],
          data: copies.map((c) => {
            const b = books.find((bk) => bk.id === c.bookId);
            return [c.copyCode, b?.title || '-', c.shelfLocation, c.status, c.condition];
          }),
        };

      case 'loans':
        return {
          title: 'تقرير الإعارات الشامل',
          columns: ['رمز النسخة', 'عنوان الكتاب', 'اسم الطالب', 'الصف', 'تاريخ الإعارة', 'تاريخ الاستحقاق', 'الحالة'],
          data: loans.map((l) => {
            const c = copies.find((cp) => cp.id === l.copyId);
            const b = books.find((bk) => bk.id === c?.bookId);
            const s = students.find((st) => st.id === l.studentId);
            return [c?.copyCode || '-', b?.title || '-', s?.fullName || '-', s?.grade || '-', formatArabicDate(l.loanDate), formatArabicDate(l.dueDate), l.status];
          }),
        };

      case 'overdue': {
        const overdues = loans.filter((l) => l.status === 'active' && isOverdue(l.dueDate));
        return {
          title: 'تقرير الكتب المتأخرة عن موعد الإرجاع',
          columns: ['رمز النسخة', 'عنوان الكتاب', 'الطالب المستعير', 'المجموعة', 'موعد الإرجاع المقترح'],
          data: overdues.map((l) => {
            const c = copies.find((cp) => cp.id === l.copyId);
            const b = books.find((bk) => bk.id === c?.bookId);
            const s = students.find((st) => st.id === l.studentId);
            return [c?.copyCode || '-', b?.title || '-', s?.fullName || '-', s?.groupName || '-', formatArabicDate(l.dueDate)];
          }),
        };
      }

      case 'students':
        return {
          title: 'تقرير سجل عضوية الطلاب',
          columns: ['كود الطالب', 'اسم الطالب', 'الصف', 'المجموعة', 'حالة رمز الدخول', 'إجمالي المقروء', 'الإعارات الحالية', 'الحالة'],
          data: students.map((s) => [s.internalId, s.fullName, s.grade, s.groupName, s.accessCodeHash ? 'مشفّر ومفعّل' : 'غير معيّن', s.totalBooksRead, s.currentActiveLoans, s.status]),
        };

      case 'top_books': {
        const bookLoanCounts: Record<string, number> = {};
        loans.forEach((l) => {
          const c = copies.find((cp) => cp.id === l.copyId);
          if (c) bookLoanCounts[c.bookId] = (bookLoanCounts[c.bookId] || 0) + 1;
        });
        const sortedBooks = [...books].sort((a, b) => (bookLoanCounts[b.id] || 0) - (bookLoanCounts[a.id] || 0));
        return {
          title: 'تقرير أكثر الكتب طلباً واستعارة',
          columns: ['الترتيب', 'رمز الكتاب', 'عنوان الكتاب', 'المؤلف', 'عدد مرات الاستعارة'],
          data: sortedBooks.map((b, i) => [i + 1, b.code, b.title, b.author, bookLoanCounts[b.id] || 0]),
        };
      }

      case 'damage_reports': {
        const damaged = conditionReports.filter((r) => r.rating === 'damaged' || r.rating === 'needs_monitoring');
        return {
          title: 'تقرير فحص التلف ومتابعة صيانة الكتب',
          columns: ['رمز النسخة', 'تاريخ الفحص', 'المرحلة', 'التقييم', 'الملاحظات والضرر'],
          data: damaged.map((r) => {
            const c = copies.find((cp) => cp.id === r.copyId);
            return [c?.copyCode || '-', formatArabicDateTime(r.createdAt), r.stage, r.rating, r.details || '-'];
          }),
        };
      }

      case 'supervisor_perf':
        return {
          title: 'تقرير أداء المشرفين والعمليات المنجزة',
          columns: ['اسم المشرف', 'اسم المستخدم', 'الدور', 'الحالة', 'صلاحيات الإعارة'],
          data: staff.map((st) => [st.fullName, st.username, st.role, st.status, st.permissions.can_checkout ? 'مفعلة' : 'معطلة']),
        };

      case 'single_student': {
        const targetStudent = students.find((s) => s.id === selectedStudentId);
        const studentLoans = loans.filter((l) => l.studentId === selectedStudentId);
        return {
          title: `تقرير السجل القرائي الشامل للطالب: ${targetStudent?.fullName || ''}`,
          columns: ['الكتاب', 'رمز النسخة', 'تاريخ الاستعارة', 'تاريخ الإرجاع', 'الحالة'],
          data: studentLoans.map((l) => {
            const c = copies.find((cp) => cp.id === l.copyId);
            const b = books.find((bk) => bk.id === c?.bookId);
            return [b?.title || '-', c?.copyCode || '-', formatArabicDate(l.loanDate), formatArabicDate(l.returnDate), l.status];
          }),
        };
      }

      default:
        return { title: 'تقرير عام', columns: [], data: [] };
    }
  };

  const currentPayload = getReportPayload();

  const handlePrint = () => {
    let rowsHtml = '';
    currentPayload.data.forEach((row: any[]) => {
      rowsHtml += `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
    });

    const content = `
      <table>
        <thead>
          <tr>${currentPayload.columns.map((c) => `<th>${c}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="8" style="text-align: center;">لا توجد بيانات مسجلة</td></tr>'}
        </tbody>
      </table>
    `;

    printDirectReport(currentPayload.title, content);
  };

  const handleExportExcel = () => {
    const excelData = currentPayload.data.map((row: any[]) => {
      const obj: Record<string, any> = {};
      currentPayload.columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    exportToExcel(excelData, currentPayload.title.replace(/\s+/g, '_'));
    showToast('تم تصدير التقرير كملف Excel بنجاح', 'success');
  };

  const handleOperationalPdf = async () => {
    setExportingPdf(true);
    try {
      await downloadOfficialReportPdf(
        {
          reportTitle: currentPayload.title,
          periodLabel: 'البيانات الحالية بالنظام',
          metadata: [{ label: 'إجمالي السجلات', value: String(currentPayload.data.length) }],
          kpis: [],
          tables: [
            {
              title: currentPayload.title,
              columns: currentPayload.columns,
              rows: currentPayload.data,
            },
          ],
        },
        reportSettings,
        currentPayload.title.replace(/\s+/g, '_')
      );
      showToast('تم تصدير التقرير بصيغة PDF بنجاح 📄', 'success');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Header Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-wathba-100 text-wathba-800">
              <FileText className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">مركز التقارير والإحصائيات الشامل</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            تقارير تفصيلية دقيقة للمجموعات، والتقارير الفردية للطلاب، مع الرسوم البيانية وتصدير PDF وExcel والطباعة المعتمدة بتوقيت الرياض.
          </p>
        </div>
      </div>

      {/* Top Navigation Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 bg-white p-2 rounded-2xl border border-[#dde6ed] shadow-sm">
        <button
          type="button"
          onClick={() => setMainTab('group')}
          className={`py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            mainTab === 'group' ? 'bg-[#3b707d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>1. تقرير المجموعة والتحليل</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('student')}
          className={`py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            mainTab === 'student' ? 'bg-[#3b707d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>2. التقرير الفردي للطالب</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('operational')}
          className={`py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            mainTab === 'operational' ? 'bg-[#3b707d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>3. التقارير التشغيلية (9)</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('analytics')}
          className={`py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            mainTab === 'analytics' ? 'bg-[#3b707d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>4. الإحصائيات والتحليلات</span>
        </button>
      </div>

      {/* TAB 1: GROUP REPORT */}
      {mainTab === 'group' && <GroupReportView onSelectStudent={handleOpenStudentFromGroup} />}

      {/* TAB 2: STUDENT INDIVIDUAL REPORT */}
      {mainTab === 'student' && (
        <StudentIndividualReportView
          selectedStudentId={selectedStudentId}
          onChangeStudent={setSelectedStudentId}
        />
      )}

      {/* TAB 3: OPERATIONAL REPORTS (PRESERVED + PDF SUPPORT) */}
      {mainTab === 'operational' && (
        <div className="space-y-5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-black text-slate-800">اختر التقرير التشغيلي المباشر:</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={exportingPdf}
                icon={<Download className="w-4 h-4" />}
                onClick={handleOperationalPdf}
              >
                PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={handleExportExcel}
              >
                Excel (XLSX)
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Printer className="w-4 h-4" />}
                onClick={handlePrint}
              >
                طباعة مباشرة
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 text-xs">
            {[
              { id: 'all_books', title: '1. جميع الكتب' },
              { id: 'all_copies', title: '2. جميع النسخ' },
              { id: 'loans', title: '3. سجل الإعارات' },
              { id: 'overdue', title: '4. الكتب المتأخرة' },
              { id: 'students', title: '5. سجل الطلاب' },
              { id: 'top_books', title: '6. الأكثر استعارة' },
              { id: 'damage_reports', title: '7. التلف والمفقودات' },
              { id: 'supervisor_perf', title: '8. أداء المشرفين' },
              { id: 'single_student', title: '9. إعارات طالب محدد' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveReportType(item.id)}
                className={`py-2 px-3 rounded-xl font-bold transition-all text-center ${
                  activeReportType === item.id
                    ? 'bg-wathba-700 text-white shadow-soft'
                    : 'bg-white/80 text-slate-700 hover:bg-white'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>

          {activeReportType === 'single_student' && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-soft flex items-center gap-3 text-xs">
              <span className="font-bold text-slate-700">اختر الطالب:</span>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-wathba-500"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.grade} - {s.groupName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">{currentPayload.title}</span>
              <span className="text-xs text-slate-500 font-bold">
                إجمالي السجلات: {currentPayload.data.length}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    {currentPayload.columns.map((c: string, idx: number) => (
                      <th key={idx} className="p-3.5">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentPayload.data.length === 0 ? (
                    <tr>
                      <td colSpan={currentPayload.columns.length} className="p-12 text-center text-slate-400">
                        لا توجد بيانات مطابقة في هذا التقرير
                      </td>
                    </tr>
                  ) : (
                    currentPayload.data.map((row: any[], rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        {row.map((cell: any, cIdx: number) => (
                          <td key={cIdx} className="p-3.5">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#dde6ed] p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-[#1c353d]">الإحصائيات والتحليلات القرائية والمكتبية</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  قراءة شاملة لتوزيع النسخ، نشاط المجموعات، والمناقشات القرائية المعتمدة
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setMainTab('group')}>
                  تقارير المجموعات
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setMainTab('operational')}>
                  التقارير التشغيلية
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]">
                <span className="text-[11px] font-bold text-slate-500 block">نسبة توفر النسخ</span>
                <span className="text-2xl font-black text-[#3b707d] mt-1 block">
                  {copies.length > 0
                    ? `${Math.round((copies.filter((c) => c.status === 'available').length / copies.length) * 100)}%`
                    : '0%'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {copies.filter((c) => c.status === 'available').length} من {copies.length} نسخة
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]">
                <span className="text-[11px] font-bold text-slate-500 block">إجمالي الإعارات المسجلة</span>
                <span className="text-2xl font-black text-[#1c353d] mt-1 block">{loans.length}</span>
                <span className="text-[11px] text-slate-500">
                  {loans.filter((l) => l.status === 'active').length} إعارة نشطة حالياً
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]">
                <span className="text-[11px] font-bold text-slate-500 block">المناقشات المعتمدة</span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  {(discussions || []).filter((d) => d.status === 'approved').length}
                </span>
                <span className="text-[11px] text-slate-500">
                  من أصل {(discussions || []).length} طلب مناقشة
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]">
                <span className="text-[11px] font-bold text-slate-500 block">سجلات الصفحات المعتمدة</span>
                <span className="text-2xl font-black text-[#3b707d] mt-1 block">
                  {(readingLogs || []).reduce((sum, r) => sum + (r.correctedPagesCount ?? r.pagesCount ?? 0), 0)}
                </span>
                <span className="text-[11px] text-slate-500">صفحة مسجلة للطلاب</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl border border-[#dde6ed] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-[#1c353d]">عناوين الكتب وحالة النسخ</h4>
                  <span className="text-[11px] font-bold text-slate-500 font-mono">
                    {books.length} كتاب
                  </span>
                </div>
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-0.5 scrollbar-thin">
                  {books.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      لا توجد كتب مسجلة في المكتبة حالياً
                    </div>
                  ) : (
                    books.map((b) => {
                      const availPct =
                        b.totalCopiesCount > 0
                          ? Math.round((b.availableCopiesCount / b.totalCopiesCount) * 100)
                          : 0;
                      return (
                        <div key={b.id} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <div className="min-w-0 pr-1">
                              <span className="font-bold text-slate-800 truncate block">
                                {b.title}
                              </span>
                              {b.author && (
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {b.author}
                                </span>
                              )}
                            </div>
                            <div className="text-left shrink-0 font-mono text-[11px]">
                              <span className="font-black text-[#2c5661]">
                                {b.availableCopiesCount} متاح
                              </span>
                              <span className="text-slate-400"> / {b.totalCopiesCount} نسخة</span>
                              <span className="text-slate-400 text-[10px] mr-1">
                                ({availPct}%)
                              </span>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-[#e3ecf3] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#3b707d] transition-all duration-300"
                              style={{ width: `${availPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#dde6ed] bg-white space-y-3">
                <h4 className="text-sm font-black text-[#1c353d]">نشاط المجموعات القرائية</h4>
                <div className="space-y-2">
                  {Array.from(new Set(students.map((s) => s.groupName).filter(Boolean))).map((grp) => {
                    const members = students.filter((s) => s.groupName === grp);
                    const booksRead = members.reduce((sum, s) => sum + (s.totalBooksRead || 0), 0);
                    const activeLoans = members.reduce((sum, s) => sum + (s.currentActiveLoans || 0), 0);
                    return (
                      <div
                        key={grp}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-[#f4f7f9] border border-[#dde6ed]/70 text-xs"
                      >
                        <div>
                          <span className="font-black text-[#1c353d] block">{grp}</span>
                          <span className="text-[11px] text-slate-500">{members.length} طالب</span>
                        </div>
                        <div className="text-left">
                          <span className="font-black text-[#3b707d] block">{booksRead} كتاب مقروء</span>
                          <span className="text-[11px] text-slate-500">{activeLoans} إعارة نشطة</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
