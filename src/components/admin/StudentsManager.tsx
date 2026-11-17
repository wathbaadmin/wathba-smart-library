import React, { useState, useEffect, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Student } from '../../types';
import { BatchCredentialsModal } from './BatchCredentialsModal';
import { StudentCredentialsPrintSheet } from './StudentCredentialsPrintSheet';
import {
  generateStudentAccessCode,
  generateUniqueStudentCode,
  normalizeStudentCode,
} from '../../lib/studentAuthService';
import { AddStudentModal } from './AddStudentModal';
import { EditStudentModal } from './EditStudentModal';
import { StudentQrModal } from './StudentQrModal';
import { BulkImportStudentsModal } from './BulkImportStudentsModal';
import { StudentCardPrintSheet } from '../qr/StudentCardPrintSheet';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { exportToExcel } from '../../lib/exportUtils';
import { useAuth } from '../../context/AuthContext';
import { filterStudentsForStaffScope } from '../../lib/discussionUtils';
import {
  Users,
  Plus,
  Upload,
  Printer,
  Download,
  Search,
  KeyRound,
  RotateCcw,
  ShieldAlert,
  Edit,
  GraduationCap,
  FileText,
  Copy,
  Check,
  Eye,
  EyeOff,
  Hash,
  RefreshCw,
  ShieldCheck,
  Layers,
  QrCode,
} from 'lucide-react';

export interface StudentsManagerProps {
  onOpenStudentReport?: (studentId: string) => void;
  initialView?: 'students' | 'groups';
}

export const StudentsManager: React.FC<StudentsManagerProps> = ({
  onOpenStudentReport,
  initialView = 'students',
}) => {
  const { currentStaff } = useAuth();
  const {
    students,
    staff,
    loans,
    addStudent,
    bulkAddStudents,
    updateStudent,
    regenerateStudentCode,
    resetStudentAccessCode,
    isStudentCodeAvailable,
    issuedStudentCredentials,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [viewMode, setViewMode] = useState<'students' | 'groups'>(initialView);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [batchCredsOpen, setBatchCredsOpen] = useState(false);
  const [printCredsOpen, setPrintCredsOpen] = useState(false);

  // Credential reset / edit modal state
  const [credentialTarget, setCredentialTarget] = useState<Student | null>(null);
  const [editStudentCode, setEditStudentCode] = useState('');
  const [editAccessPin, setEditAccessPin] = useState('');
  const [showEditPin, setShowEditPin] = useState(true);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [savedCredentialResult, setSavedCredentialResult] = useState<{
    studentCode: string;
    plainAccessCode: string;
    fullName: string;
  } | null>(null);

  useEffect(() => {
    setViewMode(initialView);
  }, [initialView]);

  const openCredentialModal = (student: Student) => {
    setCredentialTarget(student);
    setEditStudentCode(student.internalId);
    setEditAccessPin(generateStudentAccessCode(6));
    setShowEditPin(true);
    setCredentialError(null);
    setSavedCredentialResult(null);
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialTarget) return;
    const cleanCode = normalizeStudentCode(editStudentCode);
    if (!cleanCode || cleanCode.length < 3) {
      setCredentialError('يرجى إدخال كود طالب صالح (3 أحرف أو أرقام على الأقل).');
      return;
    }
    if (!isStudentCodeAvailable(cleanCode, credentialTarget.id)) {
      setCredentialError(`كود الطالب "${cleanCode}" مستخدم بالفعل لطالب آخر.`);
      return;
    }
    const cleanPin = editAccessPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setCredentialError('يرجى إدخال رمز دخول من 4 خانات فأكثر.');
      return;
    }

    const res = resetStudentAccessCode({
      studentId: credentialTarget.id,
      customStudentCode: cleanCode,
      customAccessCode: cleanPin,
      staffId: currentStaff?.id,
    });
    if (!res.success || !res.credential) {
      setCredentialError(res.error || 'تعذر تحديث بيانات دخول الطالب.');
      return;
    }

    setSavedCredentialResult({
      studentCode: res.credential.studentCode,
      plainAccessCode: res.credential.plainAccessCode,
      fullName: credentialTarget.fullName,
    });
    showToast(`تم تحديث بيانات دخول ${credentialTarget.fullName} بنجاح`, 'success');
  };

  const handleCopyText = async (text: string, label: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCodeId(keyId);
      showToast(`تم نسخ ${label}`, 'success');
      setTimeout(() => setCopiedCodeId(null), 2000);
    } catch {
      showToast('تعذر النسخ التلقائي للحافظة', 'warning');
    }
  };

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const scopedStudents = filterStudentsForStaffScope(students, liveStaff);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [qrManageStudent, setQrManageStudent] = useState<Student | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [printCardsOpen, setPrintCardsOpen] = useState(false);
  const [singleStudentCard, setSingleStudentCard] = useState<Student | null>(null);

  const uniqueGrades = Array.from(new Set(scopedStudents.map((s) => s.grade)));
  const uniqueGroups = Array.from(new Set(scopedStudents.map((s) => s.groupName)));

  const filteredStudents = scopedStudents.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      s.fullName.toLowerCase().includes(term) ||
      s.internalId.toLowerCase().includes(term) ||
      s.groupName.toLowerCase().includes(term);

    const matchGrade = selectedGrade === 'all' || s.grade === selectedGrade;
    const matchGroup = selectedGroup === 'all' || s.groupName === selectedGroup;

    return matchSearch && matchGrade && matchGroup;
  });

  const handleToggleStatus = (student: Student) => {
    const nextStatus = student.status === 'active' ? 'suspended' : 'active';
    updateStudent({ ...student, status: nextStatus });
    showToast(
      nextStatus === 'suspended' ? `تم إيقاف حساب الطالب ${student.fullName}` : `تمت إعادة تفعيل حساب الطالب ${student.fullName}`,
      nextStatus === 'suspended' ? 'warning' : 'success'
    );
  };

  const handleRegenerateCode = (student: Student) => {
    openCredentialModal(student);
  };

  const handleExportExcel = () => {
    const data = students.map((s) => ({
      'كود الطالب': s.internalId,
      'اسم الطالب': s.fullName,
      'الصف': s.grade,
      'المرحلة': s.stage,
      'المجموعة': s.groupName,
      'رمز الدخول': issuedStudentCredentials[s.id]?.plainAccessCode || 'مشفّر ومفعّل (للطباعة عند الإصدار فقط)',
      'الحالة': s.status === 'active' ? 'نشط' : 'معلق',
      'الكتب المقروءة': s.totalBooksRead,
      'الإعارات الحالية': s.currentActiveLoans,
    }));
    exportToExcel(data, 'سجل_طلاب_مكتبة_وثبة');
    showToast('تم تصدير سجل الطلاب الآمن كملف Excel', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-royal-100 text-royal-800">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              إدارة شؤون الطلاب وبطاقات الـ QR
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            إضافة الطلاب، استيراد القوائم الجماعية من ملفات Excel، إصدار وطباعة بطاقات العضوية وبيانات الدخول المشفّرة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<KeyRound className="w-4 h-4" />}
            onClick={() => setBatchCredsOpen(true)}
          >
            إنشاء بيانات دخول لعدة طلاب
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => setPrintCredsOpen(true)}
          >
            طباعة بيانات الدخول
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleExportExcel}
          >
            تصدير Excel
          </Button>
          <Button
            variant="royal"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={() => setPrintCardsOpen(true)}
          >
            طباعة جميع بطاقات QR
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => setImportModalOpen(true)}
          >
            استيراد من Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setAddModalOpen(true)}
          >
            إضافة طالب جديد
          </Button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-1.5 bg-[#f4f7f9] p-1 rounded-xl border border-[#dde6ed] w-fit">
        <button
          type="button"
          onClick={() => setViewMode('students')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
            viewMode === 'students'
              ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          قائمة الطلاب وحسابات الدخول ({students.length})
        </button>
        <button
          type="button"
          onClick={() => setViewMode('groups')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
            viewMode === 'groups'
              ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          المجموعات القرائية ({Array.from(new Set(students.map((s) => s.groupName).filter(Boolean))).length})
        </button>
      </div>

      {viewMode === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(new Set(students.map((s) => s.groupName).filter(Boolean))).map((grp) => {
            const members = students.filter((s) => s.groupName === grp);
            const activeMembers = members.filter((m) => m.status === 'active').length;
            const totalBooksRead = members.reduce((sum, m) => sum + (m.totalBooksRead || 0), 0);
            const activeLoansCount = (loans || []).filter(
              (l) => l.status === 'active' && members.some((m) => m.id === l.studentId)
            ).length;
            const assignedSupervisors = staff.filter(
              (st) => st.status === 'active' && st.assignedGroups?.includes(grp)
            );
            return (
              <div
                key={grp}
                className="bg-white rounded-2xl border border-[#dde6ed] p-5 shadow-sm hover:border-[#3b707d]/50 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#e3ecf3] text-[#3b707d] flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-[#1c353d]">{grp}</h3>
                        <p className="text-[11px] text-slate-500">
                          {members.length} طالب • {activeMembers} نشط
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]/70">
                      <span className="text-[10px] text-slate-500 block">إجمالي المقروء</span>
                      <span className="font-black text-[#1c353d]">{totalBooksRead} كتاب</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f4f7f9] border border-[#dde6ed]/70">
                      <span className="text-[10px] text-slate-500 block">إعارات نشطة</span>
                      <span className="font-black text-[#3b707d]">{activeLoansCount} إعارة</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600">
                    <span className="font-bold text-slate-700">المشرفون: </span>
                    {assignedSupervisors.length > 0
                      ? assignedSupervisors.map((s) => s.fullName).join('، ')
                      : 'إشراف عام مشترك'}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSearchTerm(grp);
                      setViewMode('students');
                    }}
                  >
                    عرض طلاب المجموعة
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'students' && (
        <>
          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#e3ecf3] shadow-soft flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 text-xs">
        <div className="relative w-full md:flex-1 md:min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم الطالب، رقمه الداخلي، أو مجموعته..."
            className="w-full min-h-[44px] pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <span className="text-slate-500 font-bold shrink-0">الصف:</span>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
          >
            <option value="all">جميع الصفوف</option>
            {uniqueGrades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <span className="text-slate-500 font-bold shrink-0">المجموعة:</span>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
          >
            <option value="all">جميع المجموعات</option>
            {uniqueGroups.map((grp) => (
              <option key={grp} value={grp}>
                {grp}
              </option>
            ))}
          </select>
        </div>

        <span className="text-[#3b707d] md:mr-auto font-black bg-[#e3ecf3]/60 px-3 py-1.5 rounded-xl self-start md:self-auto">
          {filteredStudents.length} طالب مسجل
        </span>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#e3ecf3] p-10 text-center text-slate-400 text-xs shadow-soft">
            لا يوجد طلاب مطابقين للبحث
          </div>
        ) : (
          filteredStudents.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-[#e3ecf3] p-4 shadow-soft space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-black text-sm text-slate-900 truncate">{s.fullName}</div>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-xs font-black text-[#1c353d]" dir="ltr">{s.internalId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(s.internalId, 'كود الطالب', `code-${s.id}`)}
                      className="p-1 rounded-md text-slate-400 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60 transition-colors"
                      title="نسخ كود الطالب"
                    >
                      {copiedCodeId === `code-${s.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={s.status} size="sm" />
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.qrTokenStatus === 'revoked'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : s.qrLoginEnabled === false
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-[#e3ecf3]/70 text-[#284d57]'
                    }`}
                  >
                    {s.qrTokenStatus === 'revoked'
                      ? 'QR ملغى'
                      : s.qrLoginEnabled === false
                      ? 'QR معطّل'
                      : 'QR مفعّل'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs bg-[#f6f8fa] p-3 rounded-xl border border-[#e3ecf3]/70">
                <div>
                  <span className="text-[10px] text-slate-400 block">الصف والمرحلة</span>
                  <span className="font-bold text-slate-800 block">{s.grade}</span>
                  <span className="text-[10px] text-slate-500">{s.stage}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">المجموعة</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-lg bg-[#e3ecf3] text-[#284d57] font-bold text-[11px]">
                    {s.groupName}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">رمز الدخول</span>
                  <span className="font-mono font-black text-slate-900 text-xs">
                    {issuedStudentCredentials[s.id]?.plainAccessCode || (!s.accessCodeHash ? '⚠️ لم يُنشأ بعد' : 'مشفّر ومحمي')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">الإعارات الحالية</span>
                  <span className="font-black text-[#3b707d]">{s.currentActiveLoans} / 2</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                {onOpenStudentReport && (
                  <button
                    type="button"
                    onClick={() => onOpenStudentReport(s.id)}
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-[#e3ecf3]/60 hover:bg-[#e3ecf3] text-[#284d57] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>التقرير</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setQrManageStudent(s)}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-xl bg-[#e3ecf3]/75 hover:bg-[#e3ecf3] text-[#1c353d] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <QrCode className="w-4 h-4 shrink-0 text-[#3b707d]" />
                  <span>باركود QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSingleStudentCard(s)}
                  className="min-w-[42px] min-h-[40px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  title="طباعة بطاقة الطالب"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStudent(s)}
                  className="min-w-[42px] min-h-[40px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  title="تعديل بيانات الطالب"
                >
                  <Edit className="w-4 h-4 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRegenerateCode(s)}
                  className="min-w-[42px] min-h-[40px] px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  title="إعادة إصدار رمز دخول جديد"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(s)}
                  className={`min-w-[42px] min-h-[40px] px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                    s.status === 'active'
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                  }`}
                  title={s.status === 'active' ? 'إيقاف الحساب' : 'إعادة التفعيل'}
                >
                  <ShieldAlert className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Students Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#e3ecf3] overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#f6f8fa] text-slate-700 font-bold border-b border-[#e3ecf3]">
              <tr>
                <th className="p-4">الطالب</th>
                <th className="p-4">الصف والمرحلة</th>
                <th className="p-4">المجموعة</th>
                <th className="p-4">رمز الدخول السري</th>
                <th className="p-4">الإعارات الحالية</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    لا يوجد طلاب مطابقين للبحث
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{s.fullName}</div>
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs font-black text-[#1c353d]" dir="ltr">{s.internalId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(s.internalId, 'كود الطالب', `code-${s.id}`)}
                          className="p-1 rounded-md text-slate-400 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60 transition-colors"
                          title="نسخ كود الطالب"
                        >
                          {copiedCodeId === `code-${s.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-slate-800">{s.grade}</span>
                      <span className="text-slate-400 block text-[11px]">{s.stage}</span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg bg-[#e3ecf3]/70 text-[#284d57] font-bold text-[11px] border border-[#e3ecf3]">
                        {s.groupName}
                      </span>
                    </td>
                    <td className="p-4">
                      {issuedStudentCredentials[s.id]?.plainAccessCode ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-[#3b707d] text-sm bg-[#e3ecf3]/60 px-2 py-0.5 rounded-lg" dir="ltr">
                            {issuedStudentCredentials[s.id].plainAccessCode}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                issuedStudentCredentials[s.id].plainAccessCode,
                                'رمز الدخول',
                                `pin-${s.id}`
                              )
                            }
                            className="p-1 rounded-md text-slate-400 hover:text-[#3b707d]"
                            title="نسخ رمز الدخول"
                          >
                            {copiedCodeId === `pin-${s.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : !s.accessCodeHash ? (
                        <button
                          type="button"
                          onClick={() => openCredentialModal(s)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-black transition-colors"
                          title="هذا الطالب موجود مسبقاً ولكن لم يُنشأ له رمز دخول بعد. اضغط هنا لإنشاء رمز دخول له فوراً."
                        >
                          <KeyRound className="w-3.5 h-3.5 text-rose-600" />
                          <span>+ إنشاء رمز الدخول</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCredentialModal(s)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#e3ecf3]/70 text-slate-600 hover:text-[#1c353d] text-[11px] font-bold transition-colors"
                          title="إعادة تعيين أو تعديل كود ورمز الطالب"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#3b707d]" />
                          <span>مشفّر • إعادة تعيين</span>
                        </button>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-700">
                      {s.currentActiveLoans} / 2
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col items-end gap-1">
                  <Badge status={s.status} size="sm" />
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.qrTokenStatus === 'revoked'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : s.qrLoginEnabled === false
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-[#e3ecf3]/70 text-[#284d57]'
                    }`}
                  >
                    {s.qrTokenStatus === 'revoked'
                      ? 'QR ملغى'
                      : s.qrLoginEnabled === false
                      ? 'QR معطّل'
                      : 'QR مفعّل'}
                  </span>
                </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onOpenStudentReport && (
                          <button
                            onClick={() => onOpenStudentReport(s.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60"
                            title="عرض التقرير الفردي الشامل للطالب"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setQrManageStudent(s)}
                          className="p-2 rounded-lg text-[#3b707d] hover:bg-[#e3ecf3]/80"
                          title="عرض وإدارة باركود QR للدخول"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSingleStudentCard(s)}
                          className="p-2 rounded-lg text-slate-500 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60"
                          title="طباعة بطاقة QR للطالب"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingStudent(s)}
                          className="p-2 rounded-lg text-slate-500 hover:text-[#3b707d] hover:bg-[#e3ecf3]/60"
                          title="تعديل بيانات الطالب"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRegenerateCode(s)}
                          className="p-2 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                          title="إعادة إصدار رمز دخول جديد"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(s)}
                          className={`p-2 rounded-lg ${
                            s.status === 'active'
                              ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={s.status === 'active' ? 'إيقاف الحساب' : 'إعادة التفعيل'}
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Add Modal */}
      {addModalOpen && (
        <AddStudentModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          existingCount={students.length}
          onAddStudent={(data) => {
            const created = addStudent(data);
            showToast('تمت إضافة الطالب وتوليد بطاقته الذكية بنجاح', 'success');
            return created;
          }}
          onPrintCard={(stu) => setSingleStudentCard(stu)}
        />
      )}

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={!!editingStudent}
        student={editingStudent}
        onClose={() => setEditingStudent(null)}
        onSave={(updated) => {
          updateStudent(updated);
          showToast(`تم حفظ تعديلات بيانات الطالب ${updated.fullName} مع الحفاظ على ثبات الباركود`, 'success');
        }}
        onOpenQrManager={(stu) => setQrManageStudent(stu)}
      />

      {/* Student QR Lifecycle & Security Modal */}
      <StudentQrModal
        isOpen={!!qrManageStudent}
        student={qrManageStudent}
        onClose={() => setQrManageStudent(null)}
        onPrintSingleCard={(stu) => setSingleStudentCard(stu)}
      />

      {/* Bulk Import Modal */}
      {importModalOpen && (
        <BulkImportStudentsModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          existingCount={students.length}
          onConfirmImport={(newStudents, credentials) => {
            bulkAddStudents(newStudents, credentials);
            showToast(`تم استيراد ${newStudents.length} طالب وتوليد بيانات دخولهم المشفّرة بنجاح`, 'success');
          }}
        />
      )}

      {/* Batch Cards Print Modal */}
      {printCardsOpen && (
        <Modal
          isOpen={printCardsOpen}
          onClose={() => setPrintCardsOpen(false)}
          title="طباعة بطاقات عضوية الطلاب"
          maxWidth="4xl"
        >
          <StudentCardPrintSheet
            students={filteredStudents}
            onClose={() => setPrintCardsOpen(false)}
          />
        </Modal>
      )}

      {/* Single Student Card Print */}
      {singleStudentCard && (
        <Modal
          isOpen={!!singleStudentCard}
          onClose={() => setSingleStudentCard(null)}
          title={`بطاقة الطالب: ${singleStudentCard.fullName}`}
          maxWidth="md"
        >
          <StudentCardPrintSheet
            students={[singleStudentCard]}
            onClose={() => setSingleStudentCard(null)}
          />
        </Modal>
      )}

      {/* Batch Credentials Generator Modal */}
      {batchCredsOpen && (
        <BatchCredentialsModal
          isOpen={batchCredsOpen}
          onClose={() => setBatchCredsOpen(false)}
        />
      )}

      {/* Print Student Login Credentials Sheet */}
      {printCredsOpen && (
        <Modal
          isOpen={printCredsOpen}
          onClose={() => setPrintCredsOpen(false)}
          title="طباعة وتصدير بطاقات دخول الطلاب"
          maxWidth="4xl"
        >
          <StudentCredentialsPrintSheet
            students={filteredStudents}
            credentialsMap={issuedStudentCredentials}
            onClose={() => setPrintCredsOpen(false)}
          />
        </Modal>
      )}

      {/* Reset / Edit Student Code & Access PIN Modal */}
      {credentialTarget && (
        <Modal
          isOpen={!!credentialTarget}
          onClose={() => setCredentialTarget(null)}
          title={`إدارة بيانات دخول: ${credentialTarget.fullName}`}
          maxWidth="md"
        >
          {savedCredentialResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-black text-emerald-950">تم تحديث وحفظ بيانات الدخول بنجاح</h4>
                  <p className="text-xs text-emerald-800 mt-1">
                    تُعرض هذه البيانات الآن للمرة الأخيرة بشكل مقروء، وبعدها يُحفظ رمز الدخول بتجزئة مشفّرة غير قابلة للاسترجاع.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#f4f7f9] border border-[#dde6ed] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">كود الطالب:</span>
                  <span className="font-mono text-sm font-black text-[#1c353d]" dir="ltr">
                    {savedCredentialResult.studentCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">رمز الدخول الجديد:</span>
                  <span className="font-mono text-sm font-black text-[#3b707d]" dir="ltr">
                    {savedCredentialResult.plainAccessCode}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={copiedCodeId === 'cred-modal' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onClick={() =>
                    handleCopyText(
                      `الطالب: ${savedCredentialResult.fullName}\nكود الطالب: ${savedCredentialResult.studentCode}\nرمز الدخول: ${savedCredentialResult.plainAccessCode}`,
                      'بيانات الدخول كاملة',
                      'cred-modal'
                    )
                  }
                >
                  {copiedCodeId === 'cred-modal' ? 'تم النسخ' : 'نسخ كود الطالب ورمز الدخول'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Printer className="w-4 h-4" />}
                    onClick={() => {
                      setCredentialTarget(null);
                      setPrintCredsOpen(true);
                    }}
                  >
                    طباعة الورقة
                  </Button>
                  <Button type="button" variant="primary" size="sm" onClick={() => setCredentialTarget(null)}>
                    إغلاق
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveCredentials} className="space-y-4">
              {credentialError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                  {credentialError}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">كود الطالب (Student Code):</label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditStudentCode(
                        generateUniqueStudentCode(
                          students.filter((st) => st.id !== credentialTarget.id)
                        )
                      )
                    }
                    className="text-[11px] font-bold text-[#3b707d] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    توليد كود جديد
                  </button>
                </div>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    dir="ltr"
                    value={editStudentCode}
                    onChange={(e) => setEditStudentCode(e.target.value.toUpperCase())}
                    className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                  />
                </div>
                {editStudentCode && !isStudentCodeAvailable(editStudentCode, credentialTarget.id) && (
                  <p className="text-[11px] font-bold text-rose-600">هذا الكود مستخدم لطالب آخر.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700">رمز الدخول الجديد (PIN):</label>
                  <button
                    type="button"
                    onClick={() => setEditAccessPin(generateStudentAccessCode(6))}
                    className="text-[11px] font-bold text-[#3b707d] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    توليد رمز عشوائي
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type={showEditPin ? 'text' : 'password'}
                    dir="ltr"
                    value={editAccessPin}
                    onChange={(e) => setEditAccessPin(e.target.value)}
                    className="w-full pr-9 pl-10 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#3b707d]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPin((prev) => !prev)}
                    className="absolute left-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700"
                    title={showEditPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  >
                    {showEditPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="ghost" size="sm" onClick={() => setCredentialTarget(null)}>
                  إلغاء
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  اعتماد وحفظ التشفير الجديد
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};
