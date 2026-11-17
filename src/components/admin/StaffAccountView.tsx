import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { StaffUser } from '../../types';
import {
  UserCheck,
  ShieldCheck,
  Users,
  Lock,
  LogOut,
  CheckCircle2,
  Clock,
  Phone,
  AtSign,
  Edit3,
  Save,
  KeyRound,
  AlertCircle,
  User,
} from 'lucide-react';

export const StaffAccountView: React.FC = () => {
  const { currentStaff, logout, updateStaffSnapshot } = useAuth();
  const { staff, students, loans, discussions, updateStaffMember } = useLibrary();
  const { showToast } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';

  // State for editing profile/manager name
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  if (!liveStaff) return null;

  const handleOpenEdit = () => {
    setEditFullName(liveStaff.fullName);
    setEditUsername(liveStaff.username);
    setEditPhone(liveStaff.phone || '');
    setEditPassword('');
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const trimmedName = editFullName.trim();
    const trimmedUsername = editUsername.trim().toLowerCase();
    const trimmedPhone = editPhone.trim();
    const trimmedPassword = editPassword.trim();

    if (!trimmedName) {
      setEditError('يرجى كتابة الاسم الكامل أو اللقب الإداري');
      return;
    }
    if (trimmedName.length < 3) {
      setEditError('يجب أن يتكون الاسم من 3 أحرف على الأقل');
      return;
    }
    if (!trimmedUsername) {
      setEditError('يرجى كتابة اسم المستخدم للدخول');
      return;
    }

    // التحقق من عدم تكرار اسم المستخدم مع موظف آخر
    const isDuplicate = staff.some(
      (s) => s.id !== liveStaff.id && s.username.toLowerCase() === trimmedUsername
    );
    if (isDuplicate) {
      setEditError('اسم المستخدم هذا مستخدم بالفعل من قبل حساب آخر، يرجى اختيار اسم مستخدم مختلف');
      return;
    }

    const updatedStaff: StaffUser = {
      ...liveStaff,
      fullName: trimmedName,
      username: trimmedUsername,
      phone: trimmedPhone || undefined,
      ...(trimmedPassword ? { password: trimmedPassword } : {}),
    };

    updateStaffMember(updatedStaff);

    // تحديث لقطة الجلسة في sessionStorage الخاص بهذا التبويب
    updateStaffSnapshot(updatedStaff);

    showToast(
      isAdmin ? 'تم تحديث اسم وبيانات المدير العام بنجاح!' : 'تم تحديث بيانات الحساب بنجاح!',
      'success'
    );
    setEditModalOpen(false);
  };

  const permissionItems: { key: keyof NonNullable<typeof liveStaff.permissions>; label: string }[] = [
    { key: 'can_checkout', label: 'تنفيذ الإعارات وتخصيص النسخ' },
    { key: 'can_return', label: 'استلام الكتب وفحص الإرجاع' },
    { key: 'can_inspect', label: 'تقييم حالة النسخ والمراقبة' },
    { key: 'can_inventory', label: 'المشاركة في الجرد والمطابقة' },
    { key: 'can_manage_books', label: 'إدارة فهرس الكتب والتصنيفات' },
    { key: 'can_manage_students', label: 'إدارة حسابات وبيانات الطلاب' },
    { key: 'can_manage_discussions', label: 'جدولة وتنفيذ المناقشات القرائية' },
    { key: 'can_approve_discussions', label: 'اعتماد نتائج ونقاط المناقشات' },
    { key: 'can_view_reports', label: 'استعراض وتصدير التقارير' },
    { key: 'can_view_all_chats', label: 'الإشراف العام على محادثات الطلاب' },
  ];

  const myGroups = liveStaff.assignedGroups || [];
  const managedStudentsCount =
    !isAdmin && myGroups.length > 0
      ? students.filter((s) => myGroups.includes(s.groupName)).length
      : students.length;

  const handledLoansCount = loans.filter(
    (l) => l.supervisorId === liveStaff.id || l.returnedToSupervisorId === liveStaff.id
  ).length;
  const handledDiscussionsCount = (discussions || []).filter(
    (d) => d.supervisorId === liveStaff.id || d.approvedByStaffId === liveStaff.id
  ).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Profile Card */}
      <div className="bg-white rounded-2xl border border-[#dde6ed] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#3b707d] text-white flex items-center justify-center font-black text-xl shrink-0 shadow-sm">
            {liveStaff.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-[#1c353d]">{liveStaff.fullName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#e3ecf3] text-[#1c353d] border border-[#3b707d]/20">
                {isAdmin ? 'الإدارة العامة للمكتبة' : 'مشرف مكتبة معتمد'}
              </span>
              <button
                type="button"
                onClick={handleOpenEdit}
                className="p-1.5 rounded-xl bg-[#e3ecf3]/80 hover:bg-[#3b707d] text-[#3b707d] hover:text-white transition-all shadow-2xs flex items-center gap-1 text-xs font-bold"
                title="تعديل اسم المدير والبيانات الشخصية"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="text-[11px]">تعديل الاسم</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
              <span className="flex items-center gap-1 font-mono" dir="ltr">
                <AtSign className="w-3.5 h-3.5 text-[#3b707d]" />
                {liveStaff.username}
              </span>
              {liveStaff.phone && (
                <span className="flex items-center gap-1 font-mono" dir="ltr">
                  <Phone className="w-3.5 h-3.5 text-[#3b707d]" />
                  {liveStaff.phone}
                </span>
              )}
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                حساب نشط
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            icon={<Edit3 className="w-4 h-4" />}
            onClick={handleOpenEdit}
          >
            {isAdmin ? 'تعديل اسم المدير' : 'تعديل البيانات'}
          </Button>

          <Button
            type="button"
            variant="danger"
            size="md"
            icon={<LogOut className="w-4 h-4" />}
            onClick={() => logout()}
          >
            تسجيل الخروج
          </Button>
        </div>
      </div>

      {/* Scope & Activity Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>الطلاب ضمن نطاق الإشراف</span>
            <Users className="w-4 h-4 text-[#3b707d]" />
          </div>
          <p className="text-2xl font-black text-[#1c353d]">{managedStudentsCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isAdmin || myGroups.length === 0 ? 'جميع المجموعات' : myGroups.join('، ')}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>عمليات الإعارة والاستلام المنفذة</span>
            <UserCheck className="w-4 h-4 text-[#3b707d]" />
          </div>
          <p className="text-2xl font-black text-[#1c353d]">{handledLoansCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">عمليات إعارة وإرجاع موثّقة</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#dde6ed] p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>المناقشات القرائية المسجلة</span>
            <Clock className="w-4 h-4 text-[#3b707d]" />
          </div>
          <p className="text-2xl font-black text-[#3b707d]">{handledDiscussionsCount}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">جلسات مناقشة واعتماد</p>
        </div>
      </div>

      {/* Permissions Overview */}
      <div className="bg-white rounded-2xl border border-[#dde6ed] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-[#3b707d]" />
          <div>
            <h3 className="text-sm font-black text-[#1c353d]">صلاحيات الحساب وأمان الجلسة</h3>
            <p className="text-[11px] text-slate-500">
              يتم فحص الصلاحيات آلياً وتنتهي الجلسة تلقائياً بعد 30 دقيقة من عدم النشاط لحماية البيانات.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {permissionItems.map((perm) => {
            const granted = isAdmin || Boolean(liveStaff.permissions?.[perm.key]);
            return (
              <div
                key={perm.key}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                  granted
                    ? 'bg-[#f4f7f9] border-[#dde6ed] text-[#1c353d]'
                    : 'bg-slate-50/70 border-slate-200/70 text-slate-400'
                }`}
              >
                <span className="font-bold">{perm.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                    granted ? 'bg-[#e3ecf3] text-[#3b707d]' : 'bg-slate-200/70 text-slate-500'
                  }`}
                >
                  {granted ? 'مفعّلة' : 'مقيّدة'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="p-3 rounded-xl bg-[#e3ecf3]/50 border border-[#dde6ed] flex items-center gap-2.5 text-[11px] text-[#27434b]">
          <Lock className="w-4 h-4 text-[#3b707d] shrink-0" />
          <span>
            جلسة العمل مؤمّنة ومربوطة بصلاحيات الحساب النشط، وتنتهي تلقائياً بعد 30 دقيقة من عدم النشاط لحماية البيانات.
          </span>
        </div>
      </div>

      {/* Edit Profile / Manager Name Modal */}
      {editModalOpen && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => {
            setEditError(null);
            setEditModalOpen(false);
          }}
          title={isAdmin ? 'تعديل اسم وبيانات المدير العام' : 'تعديل بيانات الحساب الشخصي'}
          subtitle="يمكنك تعديل الاسم الإداري الظاهر في النظام والتقارير والمحادثات، ورقم التواصل وكلمة المرور."
          maxWidth="md"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 text-right">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isAdmin ? 'اسم المدير الكامل واللقب الإداري: *' : 'الاسم الكامل: *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => {
                    setEditFullName(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  placeholder={isAdmin ? 'مثال: أ. عبدالله التميمي (المدير العام)' : 'الاسم الكامل'}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                  autoFocus
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                هذا الاسم هو الذي سيظهر للطلاب في الإعارات، التقارير الرسمية، وشاشات المحادثات.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                اسم المستخدم للدخول: *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => {
                    setEditUsername(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  placeholder="admin"
                  dir="ltr"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                  required
                />
                <AtSign className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم الجوال للتواصل (اختياري):
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="0501112233"
                  dir="ltr"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                كلمة المرور الجديدة (اختياري):
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="اترك هذا الحقل فارغاً إذا كنت لا ترغب بتغييرها"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                اترك الحقل فارغاً للاحتفاظ بكلمة المرور الحالية دون تغيير.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditError(null);
                  setEditModalOpen(false);
                }}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={<Save className="w-4 h-4" />}
              >
                حفظ التعديلات
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
