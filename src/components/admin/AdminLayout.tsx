import React, { useState, useMemo } from 'react';
import { AdminSidebar, AdminTab, getTabLabel } from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationBell } from '../common/NotificationBell';
import { SyncStatusIndicator } from '../common/SyncStatusIndicator';
import { formatUmmAlQuraDate } from '../../lib/dateUtils';
import { filterStudentsForStaffScope } from '../../lib/discussionUtils';
import {
  Menu,
  Bell,
  LayoutDashboard,
  ScanLine,
  MessageSquareText,
  MessageSquare,
  ChevronDown,
  LogOut,
  UserCheck,
  Calendar,
} from 'lucide-react';

interface AdminLayoutProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  setActiveTab,
  children,
}) => {
  const { currentStaff, logout } = useAuth();
  const { staff, students, discussions, conversations } = useLibrary();
  const { unreadCount, setPendingChatConversationId } = useNotifications();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';

  const scopedStudentIds = useMemo(
    () => new Set(filterStudentsForStaffScope(students, liveStaff).map((s) => s.id)),
    [students, liveStaff]
  );

  const pendingDiscussionsCount = useMemo(
    () =>
      (discussions || []).filter(
        (d) =>
          (d.status === 'pending' || d.status === 'needs_rediscussion') &&
          (isAdmin || scopedStudentIds.has(d.studentId))
      ).length,
    [discussions, isAdmin, scopedStudentIds]
  );

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

  return (
    <div dir="rtl" className="min-h-screen bg-[#f4f7f9] flex flex-col lg:flex-row font-arabic text-slate-800">
      {/* Right Institutional Collapsible Sidebar + Mobile Drawer */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Workspace Column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Clean Institutional Top Bar */}
        <header className="h-16 bg-white/95 backdrop-blur-sm border-b border-[#dde6ed] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-[#dde6ed] bg-[#f4f7f9] text-[#1c353d] hover:bg-[#e3ecf3]"
              aria-label="فتح قائمة التنقل"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-[#1c353d] truncate">
                  {getTabLabel(activeTab)}
                </h2>
                <span className="hidden md:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-[#e3ecf3] text-[#27434b] border border-[#c5d8df]">
                  {isAdmin ? 'الإدارة العامة' : 'الإشراف التربوي'}
                </span>
              </div>
              <p className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                <Calendar className="w-3 h-3 text-[#3b707d]" />
                <span>{formatUmmAlQuraDate(new Date())}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Barcode Operation Shortcut */}
            <button
              type="button"
              onClick={() => setActiveTab('barcode_scanner')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f7f9] hover:bg-[#e3ecf3] border border-[#dde6ed] text-xs font-black text-[#1c353d] transition-colors"
            >
              <ScanLine className="w-4 h-4 text-[#3b707d]" />
              <span>محطة الباركود</span>
            </button>

            {/* Quick Messages Button */}
            <button
              type="button"
              onClick={() => setActiveTab('student_chats')}
              className="relative p-2 rounded-xl border border-[#dde6ed] bg-white hover:bg-[#f4f7f9] text-slate-600 hover:text-[#1c353d] transition-colors"
              title="المحادثات الواردة"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadChatsCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#3b707d] text-white text-[10px] font-black flex items-center justify-center">
                  {unreadChatsCount > 9 ? '+9' : unreadChatsCount}
                </span>
              )}
            </button>

            {/* مؤشر وحالة المزامنة الفورية والسحابية */}
            <SyncStatusIndicator onOpenSettings={() => setActiveTab('settings')} />

            {/* Notifications Center Dropdown */}
            <NotificationBell
              onOpenConversation={(convId) => {
                setPendingChatConversationId(convId);
                setActiveTab('student_chats');
              }}
            />

            {/* Account Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 pr-1.5 pl-2.5 py-1 rounded-xl border border-[#dde6ed] bg-white hover:bg-[#f4f7f9] transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#3b707d] text-white flex items-center justify-center font-black text-xs">
                  {liveStaff?.fullName.charAt(0) || 'م'}
                </div>
                <span className="hidden md:block text-xs font-black text-[#1c353d] max-w-[120px] truncate">
                  {liveStaff?.fullName || 'الحساب'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {accountMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setAccountMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute left-0 mt-2 w-52 bg-white rounded-2xl border border-[#dde6ed] shadow-xl p-1.5 z-40 space-y-1">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <span className="text-xs font-black text-[#1c353d] block truncate">
                        {liveStaff?.fullName}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {isAdmin ? 'مدير النظام' : 'مشرف مكتبة'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setActiveTab('account');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-[#f4f7f9] flex items-center gap-2"
                    >
                      <UserCheck className="w-4 h-4 text-[#3b707d]" />
                      <span>بياناتي والصلاحيات</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        logout();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Content Region */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-[1520px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Sticky Bottom Bar (<1024px) */}
      <nav
        aria-label="التنقل السريع للجوال"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-sm border-t border-[#dde6ed] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1"
      >
        {[
          { id: 'dashboard' as AdminTab, label: 'الرئيسية', icon: <LayoutDashboard className="w-5 h-5" /> },
          { id: 'barcode_scanner' as AdminTab, label: 'العمليات', icon: <ScanLine className="w-5 h-5" /> },
          {
            id: 'discussions' as AdminTab,
            label: 'المناقشات',
            icon: <MessageSquareText className="w-5 h-5" />,
            badge: pendingDiscussionsCount,
          },
          {
            id: 'student_chats' as AdminTab,
            label: 'المحادثات',
            icon: <MessageSquare className="w-5 h-5" />,
            badge: unreadChatsCount,
          },
        ].map((btn) => {
          const active = activeTab === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => setActiveTab(btn.id)}
              className={`relative py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black transition-colors ${
                active ? 'text-[#3b707d] bg-[#e3ecf3]/75' : 'text-slate-500'
              }`}
            >
              {btn.icon}
              <span>{btn.label}</span>
              {btn.badge && btn.badge > 0 ? (
                <span className="absolute top-1 left-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#3b707d] text-white text-[9px] flex items-center justify-center">
                  {btn.badge > 9 ? '+9' : btn.badge}
                </span>
              ) : null}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="py-1.5 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-black text-slate-600 hover:bg-[#f4f7f9]"
        >
          <Menu className="w-5 h-5" />
          <span>القائمة</span>
        </button>
      </nav>
    </div>
  );
};
