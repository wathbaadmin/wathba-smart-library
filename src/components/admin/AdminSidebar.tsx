import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { isOverdue } from '../../lib/dateUtils';
import { filterStudentsForStaffScope } from '../../lib/discussionUtils';
import { StaffPermissions } from '../../types';
import { MidadLogo } from '../common/MidadLogo';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Layers,
  ScanLine,
  ArrowRightLeft,
  AlertTriangle,
  Clock,
  RotateCcw,
  MessageSquareText,
  Calendar,
  CheckCircle2,
  Award,
  Trophy,
  MessageSquare,
  ShieldCheck,
  BarChart3,
  PieChart,
  FileText,
  Sliders,
  Settings,
  Bell,
  History,
  Tag,
  QrCode,
  ClipboardCheck,
  KeyRound,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  FileQuestion,
  X,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  | 'exams'
  | 'students'
  | 'groups'
  | 'staff'
  | 'permissions'
  | 'books'
  | 'book_analytics'
  | 'categories'
  | 'copies_qr'
  | 'inventory'
  | 'barcode_scanner'
  | 'loans'
  | 'loans_active'
  | 'loans_overdue'
  | 'reservations'
  | 'requests'
  | 'requests_returns'
  | 'reading_completions'
  | 'discussions'
  | 'discussions_scheduled'
  | 'discussions_completed'
  | 'discussions_groups'
  | 'achievements_leaderboard'
  | 'ranks_management'
  | 'certificates'
  | 'student_chats'
  | 'chat_oversight'
  | 'notifications'
  | 'reports'
  | 'reports_student'
  | 'reports_group'
  | 'reports_analytics'
  | 'reports_operational'
  | 'discussion_report_settings'
  | 'settings'
  | 'audit_logs'
  | 'account';

interface NavMenuItem {
  id: AdminTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeTone?: 'brand' | 'amber' | 'rose';
}

interface NavMenuGroup {
  id: string;
  label: string;
  defaultOpen?: boolean;
  items: NavMenuItem[];
}

export interface AdminSidebarProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const getTabLabel = (tab: AdminTab): string => {
  const labels: Record<AdminTab, string> = {
    dashboard: 'اللوحة الرئيسية',
    exams: 'الاختبارات الإلكترونية',
    students: 'إدارة الطلاب وبيانات الدخول',
    groups: 'المجموعات القرائية',
    staff: 'إدارة المشرفين',
    permissions: 'مصفوفة الصلاحيات',
    books: 'إدارة الكتب والفهرس',
    book_analytics: 'تحليلات الكتب وتتبع القراءة',
    categories: 'تصنيفات الكتب',
    copies_qr: 'النسخ وملصقات QR',
    inventory: 'الجرد وحالة الكتب',
    barcode_scanner: 'إعارة وفحص واستلام الكتب',
    loans: 'إدارة الإعارات',
    loans_active: 'الإعارات النشطة',
    loans_overdue: 'الكتب المتأخرة',
    reservations: 'طلبات الحجز',
    requests: 'طلبات الإرجاع والاستبدال',
    requests_returns: 'طلبات الإرجاع والاستبدال',
    reading_completions: 'طلبات إكمال الكتب',
    discussions: 'المناقشات القرائية',
    discussions_scheduled: 'المناقشات المجدولة',
    discussions_completed: 'المناقشات المكتملة والمعتمدة',
    discussions_groups: 'المناقشات الجماعية',
    achievements_leaderboard: 'لوحة الشرف والإنجازات القرائية',
    ranks_management: 'الألقاب القرائية وتسجيل القراءة',
    certificates: 'الشهادات المعتمدة',
    student_chats: 'الرسائل والمحادثات',
    chat_oversight: 'إشراف المحادثات',
    notifications: 'الإشعارات والتعميمات',
    reports: 'التقارير الشاملة',
    reports_student: 'التقارير الفردية للطلاب',
    reports_group: 'تقارير المجموعات',
    reports_analytics: 'الإحصائيات والتحليلات',
    reports_operational: 'التقارير التشغيلية والمخزون',
    discussion_report_settings: 'إعدادات المناقشات والتقارير',
    settings: 'إعدادات المكتبة والنظام',
    audit_logs: 'سجل الرقابة والأمان',
    account: 'بياناتي والحساب',
  };
  return labels[tab] || 'لوحة المكتبة';
};

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { currentStaff, logout } = useAuth();
  const {
    staff,
    students,
    loans,
    reservations,
    returnRequests,
    exchangeRequests,
    discussions,
    conversations,
    settings,
    readingCompletions,
  } = useLibrary();
  const { unreadCount } = useNotifications();

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';
  const perms: Partial<StaffPermissions> = liveStaff?.permissions || {};

  // Live counters scoped appropriately
  const scopedStudents = useMemo(
    () => filterStudentsForStaffScope(students, liveStaff),
    [students, liveStaff]
  );
  const scopedStudentIds = useMemo(
    () => new Set(scopedStudents.map((s) => s.id)),
    [scopedStudents]
  );

  const overdueCount = useMemo(
    () =>
      (loans || []).filter(
        (l) =>
          l.status === 'active' &&
          isOverdue(l.dueDate) &&
          (isAdmin || scopedStudentIds.has(l.studentId))
      ).length,
    [isAdmin, loans, scopedStudentIds]
  );

  const pendingReservationsCount = useMemo(
    () =>
      (reservations || []).filter(
        (r) =>
          (r.status === 'new_request' || r.status === 'pending_approval') &&
          (isAdmin || scopedStudentIds.has(r.studentId))
      ).length,
    [isAdmin, reservations, scopedStudentIds]
  );

  const pendingRequestsCount = useMemo(() => {
    const ret = (returnRequests || []).filter(
      (r) =>
        ['new', 'in_review', 'approved', 'waiting_for_pickup'].includes(r.status) &&
        (isAdmin || scopedStudentIds.has(r.studentId))
    ).length;
    const exc = (exchangeRequests || []).filter(
      (e) =>
        ['new', 'in_review', 'approved', 'waiting_for_old_book'].includes(e.status) &&
        (isAdmin || scopedStudentIds.has(e.studentId))
    ).length;
    return ret + exc;
  }, [exchangeRequests, isAdmin, returnRequests, scopedStudentIds]);

  const pendingDiscussionsCount = useMemo(
    () =>
      (discussions || []).filter(
        (d) =>
          (d.status === 'pending' || d.status === 'needs_rediscussion') &&
          (isAdmin || scopedStudentIds.has(d.studentId))
      ).length,
    [discussions, isAdmin, scopedStudentIds]
  );

  const pendingCompletionsCount = useMemo(() => {
    return (readingCompletions || []).filter(
      (c) =>
        (c.status === 'new' || c.status === 'pending_approval') &&
        (isAdmin || scopedStudentIds.has(c.studentId))
    ).length;
  }, [isAdmin, readingCompletions, scopedStudentIds]);

  const unreadChatsCount = useMemo(() => {
    if (!liveStaff) return 0;
    return (conversations || [])
      .filter((c) => {
        if (c.isArchived || c.status === 'archived') return false;
        if (isAdmin) return c.recipientType === 'admin';
        return c.recipientType === 'supervisor' && c.supervisorId === liveStaff.id;
      })
      .reduce((sum, c) => sum + (c.unreadCountSupervisor || 0), 0);
  }, [conversations, isAdmin, liveStaff]);

  const menuGroups: NavMenuGroup[] = useMemo(() => {
    if (isAdmin) {
      return [
        {
          id: 'home',
          label: 'الرئيسية',
          defaultOpen: true,
          items: [
            { id: 'dashboard', label: 'لوحة الإدارة', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
          ],
        },
        {
          id: 'people',
          label: 'الطلاب والمشرفون',
          defaultOpen: true,
          items: [
            { id: 'students', label: 'إدارة الطلاب', icon: <Users className="w-[18px] h-[18px]" /> },
            { id: 'groups', label: 'إدارة المجموعات', icon: <Layers className="w-[18px] h-[18px]" /> },
            { id: 'staff', label: 'إدارة المشرفين', icon: <UserCheck className="w-[18px] h-[18px]" /> },
            { id: 'permissions', label: 'الصلاحيات', icon: <KeyRound className="w-[18px] h-[18px]" /> },
          ],
        },
        {
          id: 'catalog',
          label: 'الكتب والمحتوى',
          defaultOpen: true,
          items: [
            { id: 'books', label: 'إدارة الكتب', icon: <BookOpen className="w-[18px] h-[18px]" /> },
            { id: 'book_analytics', label: 'إحصائيات الكتب', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
            { id: 'categories', label: 'التصنيفات', icon: <Tag className="w-[18px] h-[18px]" /> },
            { id: 'copies_qr', label: 'النسخ وملصقات QR', icon: <QrCode className="w-[18px] h-[18px]" /> },
            { id: 'inventory', label: 'الجرد وحالة الكتب', icon: <ClipboardCheck className="w-[18px] h-[18px]" /> },
          ],
        },
        {
          id: 'operations',
          label: 'العمليات والطلبات',
          defaultOpen: true,
          items: [
            { id: 'barcode_scanner', label: 'محطة الإعارة والباركود', icon: <ScanLine className="w-[18px] h-[18px]" /> },
            { id: 'loans_active', label: 'الإعارات النشطة', icon: <ArrowRightLeft className="w-[18px] h-[18px]" /> },
            {
              id: 'loans_overdue',
              label: 'المتأخرات',
              icon: <AlertTriangle className="w-[18px] h-[18px]" />,
              badge: overdueCount,
              badgeTone: 'rose',
            },
            {
              id: 'reservations',
              label: 'الحجوزات',
              icon: <Clock className="w-[18px] h-[18px]" />,
              badge: pendingReservationsCount,
              badgeTone: 'amber',
            },
            {
              id: 'requests_returns',
              label: 'طلبات الإرجاع والاستبدال',
              icon: <RotateCcw className="w-[18px] h-[18px]" />,
              badge: pendingRequestsCount,
              badgeTone: 'amber',
            },
            {
              id: 'reading_completions',
              label: 'طلبات إكمال الكتب',
              icon: <CheckCircle2 className="w-[18px] h-[18px]" />,
              badge: pendingCompletionsCount,
              badgeTone: 'amber',
            },
          ],
        },
        {
          id: 'engagement',
          label: 'المناقشات والإنجازات',
          defaultOpen: false,
          items: [
            {
              id: 'discussions',
              label: 'جميع المناقشات',
              icon: <MessageSquareText className="w-[18px] h-[18px]" />,
              badge: pendingDiscussionsCount,
              badgeTone: 'brand',
            },
            { id: 'discussions_groups', label: 'المناقشات الجماعية', icon: <Users className="w-[18px] h-[18px]" /> },
            { id: 'ranks_management', label: 'الألقاب القرائية', icon: <Trophy className="w-[18px] h-[18px]" /> },
            { id: 'certificates', label: 'الشهادات المعتمدة', icon: <Award className="w-[18px] h-[18px]" /> },
            { id: 'exams', label: 'الاختبارات الإلكترونية', icon: <FileQuestion className="w-[18px] h-[18px]" /> },
          ],
        },
        {
          id: 'reports',
          label: 'التقارير والتحليلات',
          defaultOpen: false,
          items: [
            { id: 'reports_student', label: 'التقارير الفردية', icon: <FileText className="w-[18px] h-[18px]" /> },
            { id: 'reports_group', label: 'تقارير المجموعات', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
            { id: 'reports_analytics', label: 'الإحصائيات والتحليلات', icon: <PieChart className="w-[18px] h-[18px]" /> },
            { id: 'reports_operational', label: 'التقارير التشغيلية', icon: <Layers className="w-[18px] h-[18px]" /> },
          ],
        },
        {
          id: 'comms_settings',
          label: 'التواصل والإعدادات',
          defaultOpen: false,
          items: [
            {
              id: 'student_chats',
              label: 'صندوق رسائل الإدارة',
              icon: <MessageSquare className="w-[18px] h-[18px]" />,
              badge: unreadChatsCount,
              badgeTone: 'brand',
            },
            { id: 'chat_oversight', label: 'إشراف المحادثات', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
            {
              id: 'notifications',
              label: 'الإشعارات والتعميمات',
              icon: <Bell className="w-[18px] h-[18px]" />,
              badge: unreadCount,
              badgeTone: 'amber',
            },
            { id: 'discussion_report_settings', label: 'إعدادات المناقشات والتقارير', icon: <Sliders className="w-[18px] h-[18px]" /> },
            { id: 'settings', label: 'الإعدادات العامة الشاملة', icon: <Settings className="w-[18px] h-[18px]" /> },
            { id: 'audit_logs', label: 'سجل الأمان والعمليات', icon: <History className="w-[18px] h-[18px]" /> },
          ],
        },
      ];
    }

    // Supervisor Menu (Role-Scoped, No Duplicate or Admin-Only Settings)
    const supervisorGroups: NavMenuGroup[] = [
      {
        id: 'home',
        label: 'الرئيسية',
        defaultOpen: true,
        items: [
          { id: 'dashboard', label: 'لوحة المشرف', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
        ],
      },
      ...(perms.can_manage_students !== false
        ? [
            {
              id: 'students_groups',
              label: 'إدارة الطلاب والمجموعات',
              defaultOpen: true,
              items: [
                { id: 'students' as AdminTab, label: 'قائمة الطلاب', icon: <Users className="w-[18px] h-[18px]" /> },
                { id: 'groups' as AdminTab, label: 'المجموعات', icon: <Layers className="w-[18px] h-[18px]" /> },
              ],
            },
          ]
        : []),
      {
        id: 'operations',
        label: 'إدارة الكتب والعمليات',
        defaultOpen: true,
        items: [
          ...(perms.can_checkout !== false || perms.can_return !== false || perms.can_inspect !== false
            ? [
                {
                  id: 'barcode_scanner' as AdminTab,
                  label: 'إعارة وفحص واستلام الكتب',
                  icon: <ScanLine className="w-[18px] h-[18px]" />,
                },
              ]
            : []),
          { id: 'loans_active', label: 'الإعارات النشطة', icon: <ArrowRightLeft className="w-[18px] h-[18px]" /> },
          {
            id: 'loans_overdue',
            label: 'الكتب المتأخرة',
            icon: <AlertTriangle className="w-[18px] h-[18px]" />,
            badge: overdueCount,
            badgeTone: 'rose',
          },
          {
            id: 'reservations',
            label: 'الحجوزات',
            icon: <Clock className="w-[18px] h-[18px]" />,
            badge: pendingReservationsCount,
            badgeTone: 'amber',
          },
          {
            id: 'requests_returns',
            label: 'طلبات الإرجاع والاستبدال',
            icon: <RotateCcw className="w-[18px] h-[18px]" />,
            badge: pendingRequestsCount,
            badgeTone: 'amber',
          },
          {
            id: 'reading_completions' as AdminTab,
            label: 'طلبات إكمال الكتب',
            icon: <CheckCircle2 className="w-[18px] h-[18px]" />,
            badge: pendingCompletionsCount,
            badgeTone: 'amber',
          },
          ...(perms.can_manage_books
            ? [{ id: 'books' as AdminTab, label: 'فهرس الكتب والنسخ', icon: <BookOpen className="w-[18px] h-[18px]" /> }]
            : []),
          { id: 'book_analytics' as AdminTab, label: 'إحصائيات الكتب', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
        ],
      },
      {
        id: 'discussions_ranks',
        label: 'المناقشات والإنجازات',
        defaultOpen: true,
        items: [
          ...(perms.can_manage_discussions !== false
            ? [
                {
                  id: 'discussions' as AdminTab,
                  label: 'طلبات المناقشة',
                  icon: <MessageSquareText className="w-[18px] h-[18px]" />,
                  badge: pendingDiscussionsCount,
                  badgeTone: 'brand' as const,
                },
                {
                  id: 'discussions_scheduled' as AdminTab,
                  label: 'المناقشات المجدولة',
                  icon: <Calendar className="w-[18px] h-[18px]" />,
                },
                {
                  id: 'discussions_completed' as AdminTab,
                  label: 'المناقشات المكتملة',
                  icon: <CheckCircle2 className="w-[18px] h-[18px]" />,
                },
              ]
            : []),
          {
            id: 'achievements_leaderboard' as AdminTab,
            label: 'لوحة الشرف والتنافس القرائي',
            icon: <Trophy className="w-[18px] h-[18px]" />,
          },
          {
            id: 'ranks_management',
            label: 'الألقاب والشهادات وتسجيل القراءة',
            icon: <Award className="w-[18px] h-[18px]" />,
          },
          {
            id: 'exams' as AdminTab,
            label: 'الاختبارات الإلكترونية',
            icon: <FileQuestion className="w-[18px] h-[18px]" />,
          },
        ],
      },
      {
        id: 'comms',
        label: 'التواصل',
        defaultOpen: true,
        items: [
          {
            id: 'student_chats',
            label: 'المحادثات مع الطلاب',
            icon: <MessageSquare className="w-[18px] h-[18px]" />,
            badge: unreadChatsCount,
            badgeTone: 'brand',
          },
          ...(perms.can_view_all_chats
            ? [
                {
                  id: 'chat_oversight' as AdminTab,
                  label: 'إشراف المحادثات',
                  icon: <ShieldCheck className="w-[18px] h-[18px]" />,
                },
              ]
            : []),
        ],
      },
      ...(perms.can_view_reports !== false
        ? [
            {
              id: 'reports',
              label: 'التقارير',
              defaultOpen: false,
              items: [
                { id: 'reports_group' as AdminTab, label: 'تقارير المجموعات', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
                { id: 'reports_student' as AdminTab, label: 'تقارير الطلاب', icon: <FileText className="w-[18px] h-[18px]" /> },
              ],
            },
          ]
        : []),
      ...(perms.can_manage_settings
        ? [
            {
              id: 'settings_group',
              label: 'الإعدادات',
              defaultOpen: false,
              items: [
                { id: 'settings' as AdminTab, label: 'الإعدادات العامة الشاملة', icon: <Settings className="w-[18px] h-[18px]" /> },
              ],
            },
          ]
        : []),
    ];

    return supervisorGroups;
  }, [
    isAdmin,
    overdueCount,
    pendingDiscussionsCount,
    pendingRequestsCount,
    pendingReservationsCount,
    perms.can_checkout,
    perms.can_inspect,
    perms.can_manage_books,
    perms.can_manage_discussions,
    perms.can_manage_students,
    perms.can_return,
    perms.can_view_all_chats,
    perms.can_view_reports,
    unreadChatsCount,
    unreadCount,
  ]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Auto-open whichever group contains the currently activeTab
  useEffect(() => {
    const activeGroup = menuGroups.find((g) => g.items.some((i) => i.id === activeTab));
    if (activeGroup && openGroups[activeGroup.id] === false) {
      setOpenGroups((prev) => ({ ...prev, [activeGroup.id]: true }));
    }
  }, [activeTab, menuGroups, openGroups]);

  const isGroupOpen = (grp: NavMenuGroup) => {
    if (openGroups[grp.id] !== undefined) return openGroups[grp.id];
    if (grp.items.some((i) => i.id === activeTab)) return true;
    return grp.defaultOpen !== false;
  };

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !isGroupOpen(menuGroups.find((g) => g.id === id)!) }));
  };

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const renderBadge = (badge?: number, tone: 'brand' | 'amber' | 'rose' = 'brand') => {
    if (!badge || badge <= 0) return null;
    const toneClass =
      tone === 'rose'
        ? 'bg-rose-100 text-rose-800 border-rose-200'
        : tone === 'amber'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-[#e3ecf3] text-[#1c353d] border-[#c5d8df]';
    return (
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono border shrink-0 ${toneClass}`}
      >
        {badge > 99 ? '+99' : badge}
      </span>
    );
  };

  const sidebarBody = (mobileDrawer: boolean) => {
    const compact = !mobileDrawer && isCollapsed;
    return (
      <div className="h-full flex flex-col bg-white border-l border-[#dde6ed] select-none">
        {/* Brand Top Header */}
        <div
          className={`h-16 px-4 border-b border-[#dde6ed] flex items-center shrink-0 ${
            compact ? 'justify-center' : 'justify-between'
          }`}
        >
          {!compact ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 flex items-center justify-center transition-transform hover:scale-105 duration-200">
                <MidadLogo variant="full" theme="dark" size="custom" className="h-9 w-auto max-w-[44px] object-contain" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-black text-slate-900 block truncate leading-tight tracking-tight">
                  مكتبة مداد
                </span>
                <span className="text-[10px] font-bold text-teal-700 block truncate mt-0.5">
                  {isAdmin ? 'الإدارة العامة للمكتبة' : 'بوابة الإشراف والمتابعة'}
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="توسيع القائمة الجانبية"
              className="w-10 h-10 rounded-2xl hover:bg-slate-100 flex items-center justify-center transition-colors p-1"
            >
              <MidadLogo variant="full" theme="dark" size="custom" className="h-8 w-auto object-contain" />
            </button>
          )}

          {mobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            !compact && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="طي القائمة الجانبية"
                className="p-1.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shadow-xs"
                aria-label="طي القائمة الجانبية"
              >
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            )
          )}
        </div>

        {compact && (
          <div className="px-2 py-2 border-b border-[#dde6ed]/70 flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="توسيع القائمة"
              className="p-1.5 rounded-lg text-slate-500 hover:text-[#1c353d] hover:bg-[#f4f7f9] w-full flex justify-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3" aria-label="التنقل الرئيسي">
          {menuGroups.map((group) => {
            const expanded = compact ? true : isGroupOpen(group);
            return (
              <div key={group.id} className="space-y-1">
                {!compact ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full px-2.5 py-1 flex items-center justify-between text-[11px] font-black text-slate-400 hover:text-[#3b707d] transition-colors"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        expanded ? 'rotate-0' : 'rotate-90'
                      }`}
                    />
                  </button>
                ) : (
                  <div className="h-px bg-[#dde6ed] mx-2 my-1.5" />
                )}

                {expanded && (
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleSelectTab(item.id)}
                            title={compact ? item.label : undefined}
                            className={`w-full relative flex items-center ${
                              compact ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                            } rounded-xl text-xs font-bold transition-all duration-150 ${
                              isActive
                                ? 'bg-[#e3ecf3]/85 text-[#1c353d] font-black'
                                : 'text-slate-600 hover:bg-[#f4f7f9] hover:text-[#1c353d]'
                            }`}
                          >
                            {isActive && (
                              <span
                                aria-hidden="true"
                                className="absolute right-0 top-1.5 bottom-1.5 w-[3px] rounded-l-full bg-[#3b707d]"
                              />
                            )}
                            <div className={`flex items-center gap-2.5 min-w-0 ${compact ? 'justify-center' : ''}`}>
                              <span className={isActive ? 'text-[#3b707d]' : 'text-slate-400'}>
                                {item.icon}
                              </span>
                              {!compact && <span className="truncate">{item.label}</span>}
                            </div>
                            {!compact && renderBadge(item.badge, item.badgeTone)}
                            {compact && item.badge && item.badge > 0 ? (
                              <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-[#3b707d]" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Pinned Account + Logout */}
        <div className="p-2.5 border-t border-[#dde6ed] bg-[#f4f7f9]/60 space-y-1.5 shrink-0">
          {!compact ? (
            <>
              <button
                type="button"
                onClick={() => handleSelectTab('account')}
                className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-right transition-colors ${
                  activeTab === 'account'
                    ? 'bg-white border border-[#3b707d]/30 text-[#1c353d]'
                    : 'hover:bg-white text-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#3b707d] text-white flex items-center justify-center font-black text-xs shrink-0">
                  {liveStaff?.fullName.charAt(0) || 'م'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black text-[#1c353d] truncate">
                    {liveStaff?.fullName || 'طاقم المكتبة'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {isAdmin ? 'مدير النظام • بياناتي' : 'مشرف • بياناتي'}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>تسجيل الخروج</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectTab('account')}
                title="بياناتي والحساب"
                className="w-9 h-9 rounded-lg bg-[#3b707d] text-white flex items-center justify-center font-black text-xs"
              >
                {liveStaff?.fullName.charAt(0) || 'م'}
              </button>
              <button
                type="button"
                onClick={() => logout()}
                title="تسجيل الخروج"
                className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sticky Sidebar (Right RTL) */}
      <aside
        className={`hidden lg:block shrink-0 h-screen sticky top-0 z-30 transition-all duration-200 ${
          isCollapsed ? 'w-[76px]' : 'w-[272px]'
        }`}
      >
        {sidebarBody(false)}
      </aside>

      {/* Mobile RTL Slide-Over Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1c353d]/45 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[84%] max-w-[310px] h-full shadow-2xl">
            {sidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
