import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { filterStudentsForStaffScope } from '../../lib/discussionUtils';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  BookOpen,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Award,
  Calendar,
  Search,
  UserCheck,
} from 'lucide-react';

interface SupervisorLogReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudentId?: string;
}

export const SupervisorLogReadingModal: React.FC<SupervisorLogReadingModalProps> = ({
  isOpen,
  onClose,
  initialStudentId,
}) => {
  const { currentStaff } = useAuth();
  const {
    students,
    staff,
    loans,
    copies,
    books,
    getBookReadingCoverage,
    getStudentRankSummary,
    recordReadingLogBySupervisor,
  } = useLibrary();
  const { showToast, addNotification } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;

  const eligibleStudents = useMemo(
    () =>
      filterStudentsForStaffScope(students, liveStaff).filter(
        (s) => s.status === 'active'
      ),
    [students, liveStaff]
  );

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [bookSearch, setBookSearch] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [fromPage, setFromPage] = useState<number>(1);
  const [toPage, setToPage] = useState<number>(15);
  const [readingDate, setReadingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return eligibleStudents;
    return eligibleStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.internalId.toLowerCase().includes(q) ||
        s.grade.toLowerCase().includes(q) ||
        s.groupName.toLowerCase().includes(q)
    );
  }, [eligibleStudents, studentSearch]);

  // كتب استعارها الطالب المختار (نشطة أو معادة) مع ربط الإعارة
  const studentBorrowedBookEntries = useMemo(() => {
    if (!selectedStudentId) return [];
    const stuLoans = (loans || []).filter(
      (l) => l.studentId === selectedStudentId && l.status !== 'cancelled'
    );
    const map = new Map<string, { loanId: string; status: string }>();
    stuLoans.forEach((l) => {
      const c = copies.find((cp) => cp.id === l.copyId);
      if (c?.bookId && !map.has(c.bookId)) {
        map.set(c.bookId, { loanId: l.id, status: l.status });
      }
    });
    return Array.from(map.entries()).map(([bookId, info]) => ({
      bookId,
      loanId: info.loanId,
      status: info.status,
    }));
  }, [selectedStudentId, loans, copies]);

  const borrowedBookIdSet = useMemo(
    () => new Set(studentBorrowedBookEntries.map((e) => e.bookId)),
    [studentBorrowedBookEntries]
  );

  const filteredCatalogBooks = useMemo(() => {
    const q = bookSearch.trim().toLowerCase();
    return (books || []).filter(
      (b) =>
        !q ||
        b.title.toLowerCase().includes(q) ||
        (b.author || '').toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q)
    );
  }, [books, bookSearch]);

  const borrowedBooksForPicker = useMemo(
    () =>
      studentBorrowedBookEntries
        .map((entry) => {
          const book = filteredCatalogBooks.find((b) => b.id === entry.bookId);
          return book ? { ...entry, book } : null;
        })
        .filter((x): x is { bookId: string; loanId: string; status: string; book: (typeof books)[number] } => Boolean(x)),
    [studentBorrowedBookEntries, filteredCatalogBooks]
  );

  const otherCatalogBooks = useMemo(
    () => filteredCatalogBooks.filter((b) => !borrowedBookIdSet.has(b.id)),
    [filteredCatalogBooks, borrowedBookIdSet]
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setStudentSearch('');
    setBookSearch('');
    setSupervisorNotes('');
    setReadingDate(new Date().toISOString().slice(0, 10));

    const targetStuId =
      initialStudentId && eligibleStudents.some((s) => s.id === initialStudentId)
        ? initialStudentId
        : eligibleStudents[0]?.id || '';
    setSelectedStudentId(targetStuId);
  }, [isOpen, initialStudentId, eligibleStudents]);

  useEffect(() => {
    if (!isOpen) return;
    if (studentBorrowedBookEntries.length > 0) {
      setSelectedBookId(studentBorrowedBookEntries[0].bookId);
    } else if (books.length > 0) {
      setSelectedBookId((prev) =>
        prev && books.some((b) => b.id === prev) ? prev : books[0].id
      );
    }
  }, [isOpen, selectedStudentId, studentBorrowedBookEntries.length, books]);

  const coverage =
    selectedStudentId && selectedBookId
      ? getBookReadingCoverage(selectedStudentId, selectedBookId)
      : null;

  const rankSummary = selectedStudentId
    ? getStudentRankSummary(selectedStudentId)
    : null;

  useEffect(() => {
    if (!isOpen || !coverage) return;
    const start = coverage.nextSuggestedFromPage;
    const suggestedEnd = Math.min(coverage.bookPageCount, start + 14);
    setFromPage(start);
    setToPage(Math.max(start, suggestedEnd));
    setErrorMsg(null);
  }, [isOpen, selectedStudentId, selectedBookId]);

  const pagesEntered =
    toPage >= fromPage && fromPage >= 1 ? toPage - fromPage + 1 : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!liveStaff) {
      setErrorMsg('يرجى تسجيل الدخول بحساب المشرف أولاً');
      return;
    }
    if (!selectedStudentId) {
      setErrorMsg('يرجى اختيار الطالب');
      return;
    }
    if (!selectedBookId) {
      setErrorMsg('يرجى اختيار الكتاب');
      return;
    }

    setSubmitting(true);
    try {
      const matchedLoan = studentBorrowedBookEntries.find(
        (x) => x.bookId === selectedBookId
      );

      const res = recordReadingLogBySupervisor({
        studentId: selectedStudentId,
        bookId: selectedBookId,
        loanId: matchedLoan?.loanId,
        fromPage,
        toPage,
        readingDate,
        supervisorNotes,
        staffId: liveStaff.id,
      });

      if (res.success) {
        const studentObj = students.find((s) => s.id === selectedStudentId);
        const bookObj = books.find((b) => b.id === selectedBookId);
        const rankMsg =
          res.newlyEarnedRanks && res.newlyEarnedRanks.length > 0
            ? ` — وترقّى إلى: ${res.newlyEarnedRanks.join('، ')} 🏆`
            : '';

        addNotification({
          recipientType: 'student',
          studentId: selectedStudentId,
          title:
            res.newlyEarnedRanks && res.newlyEarnedRanks.length > 0
              ? `مبارك! حصلت على لقب ${res.newlyEarnedRanks[0]} 🏆`
              : 'تم تسجيل واعتماد صفحات قراءة جديدة 📖',
          message: `سجّل المشرف ${liveStaff.fullName} لك (${res.pagesApproved || pagesEntered} صفحة) من كتاب "${
            bookObj?.title || ''
          }" وتمت إضافتها إلى رصيدك.`,
          type: 'success',
          actionLink: 'ranks_certificates',
        });

        showToast(
          `تم تسجيل واعتماد (${res.pagesApproved || pagesEntered} صفحة) للطالب ${
            studentObj?.fullName || ''
          }${rankMsg}`,
          'success'
        );
        onClose();
      } else {
        setErrorMsg(res.error || 'تعذر تسجيل صفحات القراءة');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل صفحات قراءة جديدة للطالب ✍️"
      subtitle="يتم توثيق القراءة واعتمادها مباشرة في رصيد الطالب وحساب ألقابه وشهاداته"
      maxWidth="md"
    >
      {eligibleStudents.length === 0 ? (
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center mx-auto">
            <UserCheck className="w-7 h-7" />
          </div>
          <p className="text-xs font-bold text-slate-700">
            لا يوجد طلاب نشطون ضمن نطاق إشرافك حالياً.
          </p>
          <Button variant="secondary" size="md" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4 text-right">
          {/* 1. البحث واختيار الطالب */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              1. اختيار الطالب: *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="ابحث باسم الطالب أو رقمه أو مجموعته..."
                className="w-full min-h-[42px] pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
              />
            </div>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
            >
              {filteredStudents.length === 0 ? (
                <option value="">لا توجد نتائج مطابقة</option>
              ) : (
                filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} — {s.grade} ({s.groupName})
                  </option>
                ))
              )}
            </select>

            {rankSummary && (
              <div className="p-2.5 rounded-xl bg-[#f6f8fa] border border-[#e3ecf3] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-bold text-slate-700">
                  الرصيد الحالي:{' '}
                  <strong className="text-[#3b707d]">
                    {rankSummary.totalApprovedPages.toLocaleString('ar-SA')} صفحة
                  </strong>
                </span>
                <span className="font-bold text-[#284d57]">
                  {rankSummary.currentRank
                    ? `اللقب: ${rankSummary.currentRank.title}`
                    : 'دون اللقب الأول بعد'}
                </span>
              </div>
            )}
          </div>

          {/* 2. اختيار الكتاب */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              2. اختيار الكتاب المقروء: *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="تصفية الكتب بالعنوان أو الرمز..."
                className="w-full min-h-[42px] pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
              />
            </div>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
            >
              {borrowedBooksForPicker.length > 0 && (
                <optgroup label="كتب من سجل استعارات الطالب">
                  {borrowedBooksForPicker.map(({ book, status }) => (
                    <option key={book.id} value={book.id}>
                      ★ {book.title} ({book.pageCount || 100} ص) —{' '}
                      {status === 'active' ? 'مستعار حالياً' : 'معاد'}
                    </option>
                  ))}
                </optgroup>
              )}
              {otherCatalogBooks.length > 0 && (
                <optgroup label="جميع كتب مكتبة مداد">
                  {otherCatalogBooks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.pageCount || 100} صفحة)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* 3. شريط تغطية الكتاب */}
          {coverage && (
            <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">تغطية الطالب للكتاب:</span>
                <span className="font-mono font-bold text-[#284d57]">
                  إجمالي: {coverage.bookPageCount} صفحة
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{
                    width: `${Math.min(100, (coverage.approvedPages / coverage.bookPageCount) * 100)}%`,
                  }}
                />
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{
                    width: `${Math.min(100, (coverage.pendingPages / coverage.bookPageCount) * 100)}%`,
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-emerald-700 font-bold">معتمد: {coverage.approvedPages} ص</span>
                {coverage.pendingPages > 0 && (
                  <span className="text-amber-700 font-bold">معلق: {coverage.pendingPages} ص</span>
                )}
                <span className="text-slate-600 font-bold">المتبقي: {coverage.remainingPages} ص</span>
              </div>

              {coverage.loggedRanges.length > 0 && (
                <div className="pt-1.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-400">نطاقات مسجلة:</span>
                  {coverage.loggedRanges.map((r, i) => (
                    <span
                      key={i}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                        r.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      ص {r.fromPage}–{r.toPage}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. نطاق الصفحات والتاريخ */}
          {coverage && coverage.remainingPages === 0 ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                تم تسجيل كامل صفحات هذا الكتاب ({coverage.bookPageCount} صفحة) وتوثيقها في سجل الطالب ورصيده تلقائياً إثر إكمال القراءة والمناقشة!
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  من صفحة:
                </label>
                <input
                  type="number"
                  min={1}
                  max={coverage?.bookPageCount || 500}
                  value={fromPage}
                  onChange={(e) => {
                    setFromPage(Number(e.target.value));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-black text-center focus:ring-2 focus:ring-[#3b707d] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  إلى صفحة:
                </label>
                <input
                  type="number"
                  min={fromPage}
                  max={coverage?.bookPageCount || 500}
                  value={toPage}
                  onChange={(e) => {
                    setToPage(Number(e.target.value));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm font-black text-center focus:ring-2 focus:ring-[#3b707d] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#3b707d]" />
                  <span>تاريخ القراءة:</span>
                </label>
                <input
                  type="date"
                  value={readingDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setReadingDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-center focus:ring-2 focus:ring-[#3b707d] outline-none"
                />
              </div>
            </div>
          )}

          {/* معاينة الأثر */}
          {pagesEntered > 0 && rankSummary && (
            <div className="p-3 rounded-2xl bg-[#e3ecf3]/75 border border-[#c5d8df] flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[#284d57] font-bold">
                <Award className="w-4 h-4 text-[#3b707d] shrink-0" />
                <span>
                  سيُعتمد للطالب: <strong>{pagesEntered} صفحة</strong>
                  {rankSummary.nextRank
                    ? ` (نحو ${rankSummary.nextRank.title})`
                    : ''}
                </span>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#3b707d] text-white font-black shrink-0">
                +{pagesEntered} ص
              </span>
            </div>
          )}

          {/* 5. ملاحظة المشرف */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات المشرف أو تقييم جلسة القراءة (اختياري):
            </label>
            <textarea
              value={supervisorNotes}
              onChange={(e) => setSupervisorNotes(e.target.value)}
              rows={2}
              placeholder="مثال: قرأ الطالب الفصلين الثاني والثالث وأجاد تلخيص أفكارهما..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              يُعتمد هذا التسجيل مباشرة باسمك ويُحدَّث رصيد الطالب وألقابه وشهاداته فور الحفظ.
            </span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="md" onClick={onClose} className="w-full sm:w-auto">
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              disabled={pagesEntered <= 0 || (coverage ? coverage.remainingPages === 0 : false)}
              icon={<CheckCircle2 className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold"
            >
              اعتماد وتسجيل الصفحات للطالب
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
