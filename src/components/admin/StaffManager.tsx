import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { StaffUser, StaffPermissions, UserRole } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Shield, UserPlus, Users, CheckCircle2, Edit3, Save, AtSign, Phone, User, KeyRound, AlertCircle } from 'lucide-react';

export interface StaffManagerProps {
  initialTab?: 'list' | 'permissions';
}

export const StaffManager: React.FC<StaffManagerProps> = ({ initialTab = 'list' }) => {
  const { staff, students, addStaffMember, updateStaffMember } = useLibrary();
  const { currentStaff, updateStaffSnapshot } = useAuth();
  const { showToast } = useNotifications();

  const isAdmin = currentStaff?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'list' | 'permissions'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [groupModalStaff, setGroupModalStaff] = useState<StaffUser | null>(null);
  const [selectedGroupsInput, setSelectedGroupsInput] = useState<string[]>([]);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('supervisor');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Staff/Manager State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('supervisor');
  const [editError, setEditError] = useState<string | null>(null);

  const handleOpenEditModal = (targetStaff: StaffUser) => {
    setEditingStaff(targetStaff);
    setEditFullName(targetStaff.fullName);
    setEditUsername(targetStaff.username);
    setEditPhone(targetStaff.phone || '');
    setEditPassword('');
    setEditRole(targetStaff.role);
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSaveEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!isAdmin) {
      showToast('هذه الصلاحية مخصصة للمدير العام فقط', 'error');
      return;
    }
    if (!editingStaff) return;

    const trimmedName = editFullName.trim();
    const trimmedUsername = editUsername.trim().toLowerCase();
    const trimmedPhone = editPhone.trim();
    const trimmedPassword = editPassword.trim();

    if (!trimmedName) {
      setEditError('يرجى إدخال الاسم الكامل');
      return;
    }
    if (trimmedName.length < 3) {
      setEditError('يجب أن يتكون الاسم من 3 أحرف على الأقل');
      return;
    }
    if (!trimmedUsername) {
      setEditError('يرجى إدخال اسم المستخدم');
      return;
    }

    const isDuplicate = staff.some(
      (s) => s.id !== editingStaff.id && s.username.toLowerCase() === trimmedUsername
    );
    if (isDuplicate) {
      setEditError('اسم المستخدم هذا مستخدم بالفعل من قبل عضو آخر');
      return;
    }

    const updatedStaff: StaffUser = {
      ...editingStaff,
      fullName: trimmedName,
      username: trimmedUsername,
      phone: trimmedPhone || undefined,
      role: editRole,
      ...(trimmedPassword ? { password: trimmedPassword } : {}),
    };

    updateStaffMember(updatedStaff);

    // تحديث لقطة الجلسة في sessionStorage الخاص بهذا التبويب في حال تعديل حساب العضو المسجل حالياً
    if (currentStaff?.id === updatedStaff.id) {
      updateStaffSnapshot(updatedStaff);
    }

    showToast(
      updatedStaff.role === 'admin'
        ? `تم تحديث اسم وبيانات المدير (${updatedStaff.fullName}) بنجاح!`
        : `تم تحديث بيانات المشرف (${updatedStaff.fullName}) بنجاح!`,
      'success'
    );
    setEditModalOpen(false);
  };

  const [permissions, setPermissions] = useState<StaffPermissions>({
    can_checkout: true,
    can_return: true,
    can_inspect: true,
    can_inventory: true,
    can_manage_books: false,
    can_manage_students: true,
    can_manage_discussions: true,
    can_approve_discussions: true,
    can_view_reports: true,
  });

  const allGroups = Array.from(new Set(students.map((s) => s.groupName).filter(Boolean)));

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!isAdmin) {
      showToast('هذه الصلاحية مخصصة للمدير العام فقط', 'error');
      return;
    }
    if (!fullName.trim()) {
      setFormError('يرجى إدخال الاسم الكامل للمشرف');
      return;
    }
    if (!username.trim()) {
      setFormError('يرجى إدخال اسم المستخدم للدخول');
      return;
    }
    if (!password.trim()) {
      setFormError('يرجى تعيين كلمة مرور للمشرف');
      return;
    }

    const newStaff: StaffUser = {
      id: `staff-${Date.now()}`,
      username: username.trim().toLowerCase(),
      password: password.trim() || 'wathba2026',
      fullName: fullName.trim(),
      role,
      status: 'active',
      permissions: {
        ...permissions,
        can_manage_settings: role === 'admin',
        can_view_all_chats: role === 'admin' ? true : Boolean(permissions.can_view_all_chats),
        can_manage_chats: permissions.can_manage_chats !== false,
      },
      assignedGroups: [],
      phone: phone.trim(),
      createdAt: new Date().toISOString(),
    };

    addStaffMember(newStaff);
    showToast(`تمت إضافة المشرف ${newStaff.fullName} بنجاح!`, 'success');
    setAddModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFullName('');
    setUsername('');
    setPassword('');
    setPhone('');
    setRole('supervisor');
    setPermissions({
      can_checkout: true,
      can_return: true,
      can_inspect: true,
      can_inventory: true,
      can_manage_books: false,
      can_manage_students: true,
      can_manage_discussions: true,
      can_approve_discussions: true,
      can_view_reports: true,
    });
  };

  const handleTogglePermission = (staffMember: StaffUser, permKey: keyof StaffPermissions) => {
    if (!isAdmin) {
      showToast('تعديل صلاحيات المشرفين متاح للمدير العام فقط', 'error');
      return;
    }
    const updated: StaffUser = {
      ...staffMember,
      permissions: {
        ...staffMember.permissions,
        [permKey]: !staffMember.permissions?.[permKey],
      },
    };
    updateStaffMember(updated);
    showToast('تم تحديث صلاحية المشرف وحفظها', 'info');
  };

  const handleOpenGroupsModal = (staffMember: StaffUser) => {
    setGroupModalStaff(staffMember);
    setSelectedGroupsInput(staffMember.assignedGroups || []);
  };

  const handleSaveGroups = () => {
    if (!groupModalStaff || !isAdmin) return;
    updateStaffMember({
      ...groupModalStaff,
      assignedGroups: selectedGroupsInput,
    });
    showToast(`تم تحديث المجموعات المسندة للمشرف ${groupModalStaff.fullName}`, 'success');
    setGroupModalStaff(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Switcher Tabs */}
      <div className="flex items-center gap-1.5 bg-[#f4f7f9] p-1 rounded-xl border border-[#dde6ed] w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
            activeTab === 'list'
              ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          حسابات المشرفين والإداريين ({staff.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
            activeTab === 'permissions'
              ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          مصفوفة الصلاحيات
        </button>
      </div>

      {activeTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-[#dde6ed] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#1c353d]">مصفوفة صلاحيات الطاقم الإشرافي</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تحكم فوري في صلاحيات المشرفين بالنظام (تنعكس مباشرة على القائمة والصلاحيات)
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#f4f7f9] text-slate-700 font-black border-b border-[#dde6ed]">
                <tr>
                  <th className="p-3">المشرف / الإداري</th>
                  <th className="p-3 text-center">إعارة وإرجاع</th>
                  <th className="p-3 text-center">إدارة الطلاب</th>
                  <th className="p-3 text-center">إدارة الكتب</th>
                  <th className="p-3 text-center">اعتماد المناقشات</th>
                  <th className="p-3 text-center">التقارير</th>
                  <th className="p-3 text-center">رؤية كل المحادثات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((st) => {
                  const lockedAdmin = st.role === 'admin';
                  const togglePerm = (key: keyof StaffPermissions) => {
                    if (!isAdmin || lockedAdmin) return;
                    const updated: StaffUser = {
                      ...st,
                      permissions: {
                        ...st.permissions,
                        [key]: !st.permissions?.[key],
                      },
                    };
                    updateStaffMember(updated);
                    showToast(`تم تحديث صلاحيات ${st.fullName}`, 'success');
                  };
                  return (
                    <tr key={st.id} className="hover:bg-[#f4f7f9]/50">
                      <td className="p-3">
                        <div className="font-black text-[#1c353d]">{st.fullName}</div>
                        <div className="text-[10px] text-slate-500">
                          {st.role === 'admin' ? 'مدير عام (كامل الصلاحيات)' : 'مشرف مكتبة'}
                        </div>
                      </td>
                      {(
                        [
                          'can_checkout',
                          'can_manage_students',
                          'can_manage_books',
                          'can_approve_discussions',
                          'can_view_reports',
                          'can_view_all_chats',
                        ] as (keyof StaffPermissions)[]
                      ).map((permKey) => {
                        const allowed = lockedAdmin || Boolean(st.permissions?.[permKey]);
                        return (
                          <td key={permKey} className="p-3 text-center">
                            <button
                              type="button"
                              disabled={!isAdmin || lockedAdmin}
                              onClick={() => togglePerm(permKey)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-colors ${
                                allowed
                                  ? 'bg-[#e3ecf3] text-[#1c353d] border border-[#3b707d]/30'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200'
                              } ${lockedAdmin ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                            >
                              {allowed ? 'مفعّل' : 'مقيد'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
              <Shield className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              إدارة المشرفين وصلاحيات النظام والمجموعات
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            تحديد مهام طاقم العمل، منح صلاحيات الإعارة والاسترجاع والمناقشات والتقارير، وإسناد المجموعات لكل مشرف.
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setAddModalOpen(true)}
          >
            إضافة مشرف جديد
          </Button>
        )}
      </div>

      {/* Mobile Staff Cards */}
      <div className="md:hidden space-y-3">
        {staff.map((st) => {
          const assigned = st.assignedGroups || [];
          return (
            <div
              key={st.id}
              className="bg-white rounded-2xl border border-[#e3ecf3] p-4 shadow-soft space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-black text-sm text-slate-900 truncate">{st.fullName}</h4>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    @{st.username} {st.phone ? `• ${st.phone}` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                      st.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#3b707d]/20'
                    }`}
                  >
                    {st.role === 'admin' ? 'المدير العام' : 'مشرف مكتبة'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    نشط
                  </span>
                </div>
              </div>

              <div className="bg-[#f6f8fa] rounded-xl p-3 border border-[#e3ecf3]/70 space-y-2">
                <span className="text-[11px] font-bold text-slate-600 block">الصلاحيات:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={!!st.permissions?.can_checkout}
                      onChange={() => handleTogglePermission(st, 'can_checkout')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>تسليم</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={!!st.permissions?.can_return}
                      onChange={() => handleTogglePermission(st, 'can_return')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>استرجاع</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={!!st.permissions?.can_inspect}
                      onChange={() => handleTogglePermission(st, 'can_inspect')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>فحص</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={!!st.permissions?.can_manage_books}
                      onChange={() => handleTogglePermission(st, 'can_manage_books')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>الكتب</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={st.permissions?.can_manage_discussions !== false}
                      onChange={() => handleTogglePermission(st, 'can_manage_discussions')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>المناقشات</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={st.permissions?.can_approve_discussions !== false}
                      onChange={() => handleTogglePermission(st, 'can_approve_discussions')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>اعتماد النقاط</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={st.permissions?.can_view_reports !== false}
                      onChange={() => handleTogglePermission(st, 'can_view_reports')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>التقارير</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={st.permissions?.can_manage_chats !== false}
                      onChange={() => handleTogglePermission(st, 'can_manage_chats')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>أرشفة المحادثات</span>
                  </label>
                  <label className="flex items-center gap-1.5 min-h-[34px] col-span-2 sm:col-span-1 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin || st.role === 'admin'}
                      checked={st.role === 'admin' || !!st.permissions?.can_view_all_chats}
                      onChange={() => handleTogglePermission(st, 'can_view_all_chats')}
                      className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                    />
                    <span>متابعة كل المحادثات</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-500 ml-1">المجموعات:</span>
                  {st.role === 'admin' ? (
                    <span className="text-[11px] font-bold text-purple-700">جميع المجموعات</span>
                  ) : assigned.length === 0 ? (
                    <span className="text-[11px] text-slate-500">عام (كل المجموعات)</span>
                  ) : (
                    assigned.map((g) => (
                      <span
                        key={g}
                        className="px-2 py-0.5 rounded-lg bg-[#e3ecf3] text-[#284d57] text-[10px] font-bold"
                      >
                        {g}
                      </span>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(st)}
                      className="min-h-[34px] px-3 rounded-xl bg-[#e3ecf3]/70 hover:bg-[#3b707d] text-xs font-bold text-[#284d57] hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{st.role === 'admin' ? 'تعديل اسم المدير' : 'تعديل البيانات'}</span>
                    </button>
                  )}
                  {isAdmin && st.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleOpenGroupsModal(st)}
                      className="min-h-[34px] px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors"
                    >
                      تحديد المجموعات
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Staff Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-[#e3ecf3] overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#f6f8fa] text-slate-700 font-bold border-b border-[#e3ecf3]">
              <tr>
                <th className="p-4">المشرف / المدير</th>
                <th className="p-4">اسم المستخدم</th>
                <th className="p-4">الدور</th>
                <th className="p-4">صلاحيات التسليم والفحص</th>
                <th className="p-4">صلاحيات المناقشات والتقارير والإدارة</th>
                <th className="p-4">المجموعات المسندة</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((st) => {
                const assigned = st.assignedGroups || [];
                return (
                  <tr key={st.id} className="hover:bg-[#f6f8fa]/70 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{st.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{st.phone || '-'}</div>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-700">{st.username}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          st.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-[#e3ecf3] text-[#284d57] border border-[#3b707d]/20'
                        }`}
                      >
                        {st.role === 'admin' ? 'المدير العام' : 'مشرف مكتبة'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={!!st.permissions?.can_checkout}
                            onChange={() => handleTogglePermission(st, 'can_checkout')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>تسليم</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={!!st.permissions?.can_return}
                            onChange={() => handleTogglePermission(st, 'can_return')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>استرجاع</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={!!st.permissions?.can_inspect}
                            onChange={() => handleTogglePermission(st, 'can_inspect')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>فحص</span>
                        </label>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={!!st.permissions?.can_manage_books}
                            onChange={() => handleTogglePermission(st, 'can_manage_books')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>الكتب</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={st.permissions?.can_manage_discussions !== false}
                            onChange={() => handleTogglePermission(st, 'can_manage_discussions')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>المناقشات</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={st.permissions?.can_approve_discussions !== false}
                            onChange={() => handleTogglePermission(st, 'can_approve_discussions')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>اعتماد النقاط</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={st.permissions?.can_view_reports !== false}
                            onChange={() => handleTogglePermission(st, 'can_view_reports')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>التقارير</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin}
                            checked={st.permissions?.can_manage_chats !== false}
                            onChange={() => handleTogglePermission(st, 'can_manage_chats')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>أرشفة المحادثات</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isAdmin || st.role === 'admin'}
                            checked={st.role === 'admin' || !!st.permissions?.can_view_all_chats}
                            onChange={() => handleTogglePermission(st, 'can_view_all_chats')}
                            className="rounded text-[#3b707d] focus:ring-[#3b707d]"
                          />
                          <span>متابعة كل المحادثات</span>
                        </label>
                      </div>
                    </td>
                    <td className="p-4">
                      {st.role === 'admin' ? (
                        <span className="text-[11px] font-bold text-purple-700">جميع المجموعات</span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1">
                          {assigned.length === 0 ? (
                            <span className="text-[11px] text-slate-500">عام (كل المجموعات)</span>
                          ) : (
                            assigned.map((g) => (
                              <span
                                key={g}
                                className="px-2 py-0.5 rounded-lg bg-[#e3ecf3]/70 text-[#284d57] border border-[#e3ecf3] text-[10px] font-bold"
                              >
                                {g}
                              </span>
                            ))
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenGroupsModal(st)}
                              className="text-[11px] font-bold text-[#3b707d] hover:underline mr-1"
                            >
                              تحديد
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        نشط
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(st)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#e3ecf3]/80 hover:bg-[#3b707d] text-[#284d57] hover:text-white font-bold text-xs transition-colors inline-flex items-center gap-1 shadow-2xs"
                          title="تعديل الاسم والبيانات"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{st.role === 'admin' ? 'تعديل اسم المدير' : 'تعديل'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {addModalOpen && (
        <Modal
          isOpen={addModalOpen}
          onClose={() => {
            setFormError(null);
            setAddModalOpen(false);
          }}
          title="إضافة مشرف جديد لطاقم المكتبة"
          maxWidth="md"
        >
          <form onSubmit={handleAddStaff} noValidate className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الاسم الكامل: *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="مثال: أ. عبدالعزيز التميمي"
                className="w-full min-h-[44px] px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المستخدم للدخول: *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="supervisor2"
                  className="w-full min-h-[44px] px-3 py-2.5 text-xs rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور: *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="******"
                  className="w-full min-h-[44px] px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الدور الإداري:
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full min-h-[44px] px-3 py-2.5 text-xs rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
                >
                  <option value="supervisor">مشرف مكتبة</option>
                  <option value="admin">مدير نظام</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف:
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050..."
                  className="w-full min-h-[44px] px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="md" type="button" onClick={() => setAddModalOpen(false)} className="w-full sm:w-auto">
                إلغاء
              </Button>
              <Button variant="primary" size="md" type="submit" className="w-full sm:w-auto">
                حفظ وإضافة المشرف
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assigned Groups Modal */}
      {groupModalStaff && (
        <Modal
          isOpen={!!groupModalStaff}
          onClose={() => setGroupModalStaff(null)}
          title={`تحديد مجموعات المشرف: ${groupModalStaff.fullName}`}
          subtitle="اترك الكل غير محدد لإتاحة الإشراف العام، أو حدد مجموعات معينة تابعة لهذا المشرف"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              {allGroups.map((grp) => {
                const checked = selectedGroupsInput.includes(grp);
                return (
                  <label
                    key={grp}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked ? 'bg-wathba-50 border-wathba-400' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <Users className="w-4 h-4 text-wathba-600" />
                      <span>{grp}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedGroupsInput((prev) =>
                          prev.includes(grp) ? prev.filter((x) => x !== grp) : [...prev, grp]
                        );
                      }}
                      className="rounded text-wathba-600 focus:ring-wathba-500"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="sm" onClick={() => setGroupModalStaff(null)}>
                إلغاء
              </Button>
              <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />} onClick={handleSaveGroups}>
                حفظ المجموعات
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Staff/Manager Modal */}
      {editModalOpen && editingStaff && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => {
            setEditError(null);
            setEditModalOpen(false);
          }}
          title={
            editingStaff.role === 'admin'
              ? 'تعديل اسم وبيانات المدير العام'
              : `تعديل بيانات المشرف (${editingStaff.fullName})`
          }
          subtitle="تعديل الاسم الرسمي الظاهر في النظام والتقارير والإعارات، واسم المستخدم وكلمة المرور."
          maxWidth="md"
        >
          <form onSubmit={handleSaveEditStaff} className="space-y-4 text-right">
            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {editingStaff.role === 'admin' ? 'اسم المدير الكامل واللقب الإداري: *' : 'الاسم الكامل: *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => {
                    setEditFullName(e.target.value);
                    if (editError) setEditError(null);
                  }}
                  placeholder="الاسم الكامل"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                  autoFocus
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
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
                  dir="ltr"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                  required
                />
                <AtSign className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم الجوال:
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  dir="ltr"
                  placeholder="05xxxxxxxx"
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
