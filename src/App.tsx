import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useLibrary } from './context/LibraryContext';
import { useNotifications } from './context/NotificationContext';
import { CHAT_OPEN_CONV_EVENT_NAME } from './lib/chatService';
import { StaffPermissions } from './types';
import { StudentPortal } from './components/student/StudentPortal';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminTab } from './components/admin/AdminSidebar';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { BarcodeScannerView } from './components/admin/BarcodeScannerView';
import { BooksManager } from './components/admin/BooksManager';
import { CopiesAndQRManager } from './components/admin/CopiesAndQRManager';
import { StudentsManager } from './components/admin/StudentsManager';
import { StaffManager } from './components/admin/StaffManager';
import { ReservationsManager } from './components/admin/ReservationsManager';
import { LoansManager } from './components/admin/LoansManager';
import { RequestsManagerView } from './components/admin/RequestsManagerView';
import { SupervisorChatView } from './components/admin/SupervisorChatView';
import { DiscussionsManagerView } from './components/admin/DiscussionsManagerView';
import { DiscussionReportSettingsView } from './components/admin/DiscussionReportSettingsView';
import { RanksAndCertificatesManager } from './components/admin/RanksAndCertificatesManager';
import { InventoryManager } from './components/admin/InventoryManager';
import { ReportsManager } from './components/admin/ReportsManager';
import { NotificationsManager } from './components/admin/NotificationsManager';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { LibrarySettingsView } from './components/admin/LibrarySettingsView';
import { StaffAccountView } from './components/admin/StaffAccountView';
import { ExamsManagementView } from './components/admin/exams/ExamsManagementView';
import { BookAnalyticsView } from './components/admin/BookAnalyticsView';
import { ReadingCompletionsManagerView } from './components/admin/ReadingCompletionsManagerView';
import { PublicAchievementsView } from './components/achievements/PublicAchievementsView';
import { LoginModal } from './components/common/LoginModal';
import { LandingAndAuthView } from './components/auth/LandingAndAuthView';

const AdminRestrictedNotice: React.FC<{ title?: string; message: string }> = ({
  title = 'عفواً، هذه الصفحة مخصصة لإدارة المكتبة فقط.',
  message,
}) => (
  <div className="bg-white p-8 rounded-2xl border border-[#dde6ed] text-center space-y-2 max-w-xl mx-auto shadow-sm">
    <p className="text-sm font-black text-[#1c353d]">{title}</p>
    <p className="text-xs text-slate-500">{message}</p>
  </div>
);

export const App: React.FC = () => {
  const { authMode, currentStaff } = useAuth();
  const { staff } = useLibrary();
  const { pendingChatConversationId, setPendingChatConversationId } = useNotifications();
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<string | undefined>(undefined);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginDefaultTab] = useState<'student' | 'staff'>('student');

  // Reset to home dashboard upon staff login/role switch
  useEffect(() => {
    if (authMode === 'admin' || authMode === 'supervisor') {
      setAdminTab('dashboard');
    }
  }, [authMode, currentStaff?.id]);

  useEffect(() => {
    if (
      pendingChatConversationId &&
      (authMode === 'admin' || authMode === 'supervisor')
    ) {
      setAdminTab('student_chats');
    }
  }, [authMode, pendingChatConversationId]);

  useEffect(() => {
    const handleOpenConv = (e: Event) => {
      const detail = (e as CustomEvent<{ conversationId?: string; targetRole?: string }>)?.detail;
      if (
        detail?.conversationId &&
        (authMode === 'admin' || authMode === 'supervisor')
      ) {
        setPendingChatConversationId(detail.conversationId);
        setAdminTab('student_chats');
      }
    };
    window.addEventListener(CHAT_OPEN_CONV_EVENT_NAME, handleOpenConv);
    const handleAdminNav = (e: Event) => {
      const tab = (e as CustomEvent<AdminTab>)?.detail;
      if (tab) setAdminTab(tab);
    };
    window.addEventListener('admin_navigate_tab', handleAdminNav);
    return () => {
      window.removeEventListener(CHAT_OPEN_CONV_EVENT_NAME, handleOpenConv);
      window.removeEventListener('admin_navigate_tab', handleAdminNav);
    };
  }, [authMode, setPendingChatConversationId]);

  const handleClearPendingChat = useCallback(() => {
    setPendingChatConversationId(null);
  }, [setPendingChatConversationId]);

  const liveStaff = staff.find((s) => s.id === currentStaff?.id) || currentStaff;
  const isAdmin = liveStaff?.role === 'admin';
  const perms: Partial<StaffPermissions> = liveStaff?.permissions || {};

  const handleOpenStudentReport = (studentId: string) => {
    setSelectedReportStudentId(studentId);
    setAdminTab('reports_student');
  };

  return (
    <div className="min-h-screen bg-[#f4f7f9] font-arabic text-slate-800 antialiased selection:bg-[#3b707d] selection:text-white">
      {/* 1. Guest Landing & Portal Authentication */}
      {authMode === 'guest' && <LandingAndAuthView />}

      {/* 2. Student Portal */}
      {authMode === 'student' && <StudentPortal />}

      {/* 3. Admin / Supervisor Workspace */}
      {(authMode === 'admin' || authMode === 'supervisor') && (
        <AdminLayout activeTab={adminTab} setActiveTab={setAdminTab}>
          {adminTab === 'dashboard' && <AdminDashboard onNavigateTab={setAdminTab} />}

          {/* Students & Groups */}
          {(adminTab === 'students' || adminTab === 'groups') && (
            isAdmin || perms.can_manage_students !== false ? (
              <StudentsManager
                onOpenStudentReport={handleOpenStudentReport}
                initialView={adminTab === 'groups' ? 'groups' : 'students'}
              />
            ) : (
              <AdminRestrictedNotice message="لا تملك صلاحية إدارة حسابات وبيانات الطلاب." />
            )
          )}

          {/* Staff & Permissions (Admin Only) */}
          {(adminTab === 'staff' || adminTab === 'permissions') && (
            isAdmin ? (
              <StaffManager initialTab={adminTab === 'permissions' ? 'permissions' : 'list'} />
            ) : (
              <AdminRestrictedNotice message="إدارة المشرفين وتعديل الصلاحيات مخصصة للإدارة العامة فقط." />
            )
          )}

          {/* Books, Categories, Copies & Inventory */}
          {(adminTab === 'books' || adminTab === 'categories') && (
            <BooksManager
              onOpenStudentReport={handleOpenStudentReport}
              initialTab={adminTab === 'categories' ? 'categories' : 'catalog'}
            />
          )}
          {adminTab === 'book_analytics' && <BookAnalyticsView />}
          {adminTab === 'copies_qr' && (
            <CopiesAndQRManager onOpenStudentReport={handleOpenStudentReport} />
          )}
          {adminTab === 'inventory' && (
            isAdmin || perms.can_inventory !== false ? (
              <InventoryManager />
            ) : (
              <AdminRestrictedNotice message="لا تملك صلاحية الوصول إلى الجرد." />
            )
          )}

          {/* Barcode Checkout / Return Inspection */}
          {adminTab === 'barcode_scanner' && <BarcodeScannerView onNavigateTab={setAdminTab} />}

          {/* Loans (Active / Overdue / All) */}
          {(adminTab === 'loans' || adminTab === 'loans_active' || adminTab === 'loans_overdue') && (
            <LoansManager
              initialSubTab={adminTab === 'loans_overdue' ? 'overdue' : 'active'}
            />
          )}

          {/* Reservations */}
          {adminTab === 'reservations' && (
            <ReservationsManager initialFilter={isAdmin ? 'all' : 'pending'} />
          )}

          {/* Return & Exchange Requests */}
          {(adminTab === 'requests' || adminTab === 'requests_returns') && (
            <RequestsManagerView initialTab="all" />
          )}

          {/* Book Reading Completion Requests */}
          {adminTab === 'reading_completions' && <ReadingCompletionsManagerView />}

          {/* Discussions */}
          {(adminTab === 'discussions' ||
            adminTab === 'discussions_scheduled' ||
            adminTab === 'discussions_completed' ||
            adminTab === 'discussions_groups') && (
            isAdmin || perms.can_manage_discussions !== false ? (
              <DiscussionsManagerView
                initialSubTab={adminTab === 'discussions_groups' ? 'groups' : 'list'}
                initialStatusFilter={
                  adminTab === 'discussions_scheduled'
                    ? 'scheduled'
                    : adminTab === 'discussions_completed'
                    ? 'completed'
                    : isAdmin
                    ? 'all'
                    : 'pending'
                }
              />
            ) : (
              <AdminRestrictedNotice message="لا تملك صلاحية إدارة المناقشات القرائية." />
            )
          )}

          {/* Ranks, Reading Logs & Certificates */}
          {(adminTab === 'ranks_management' || adminTab === 'certificates') && (
            <RanksAndCertificatesManager
              initialSubTab={
                adminTab === 'certificates'
                  ? 'students_certs'
                  : isAdmin
                  ? 'ranks_config'
                  : 'stats_approvals'
              }
            />
          )}

          {/* Achievements & Leaderboard */}
          {adminTab === 'achievements_leaderboard' && <PublicAchievementsView />}

          {/* Electronic Exams System */}
          {adminTab === 'exams' && <ExamsManagementView />}

          {/* Chats (My Inbox / Oversight) */}
          {(adminTab === 'student_chats' || adminTab === 'chat_oversight') && (
            <SupervisorChatView
              initialConversationId={pendingChatConversationId || undefined}
              onConversationOpened={handleClearPendingChat}
              initialInboxMode={adminTab === 'chat_oversight' ? 'oversight' : 'my_inbox'}
            />
          )}

          {/* Reports & Analytics */}
          {(adminTab === 'reports' ||
            adminTab === 'reports_student' ||
            adminTab === 'reports_group' ||
            adminTab === 'reports_analytics' ||
            adminTab === 'reports_operational') && (
            isAdmin || perms.can_view_reports !== false ? (
              <ReportsManager
                initialStudentId={selectedReportStudentId}
                initialMainTab={
                  adminTab === 'reports_student'
                    ? 'student'
                    : adminTab === 'reports_analytics'
                    ? 'analytics'
                    : adminTab === 'reports_operational'
                    ? 'operational'
                    : 'group'
                }
              />
            ) : (
              <AdminRestrictedNotice message="لا تملك صلاحية الاطلاع على التقارير." />
            )
          )}

          {/* Admin Communications, Settings & Logs */}
          {adminTab === 'notifications' && <NotificationsManager />}
          {adminTab === 'discussion_report_settings' && (
            isAdmin ? (
              <DiscussionReportSettingsView />
            ) : (
              <AdminRestrictedNotice message="لا يملك المشرف صلاحية تعديل إعدادات التقارير والمناقشات." />
            )
          )}
          {adminTab === 'settings' && (
            isAdmin || perms.can_manage_settings ? (
              <LibrarySettingsView />
            ) : (
              <AdminRestrictedNotice message="لا يملك المشرف صلاحية تعديل الإعدادات العامة للمكتبة." />
            )
          )}
          {adminTab === 'audit_logs' && (
            isAdmin ? (
              <AuditLogsView />
            ) : (
              <AdminRestrictedNotice message="سجل الأمان والرقابة متاح للإدارة العامة فقط." />
            )
          )}

          {/* Staff / Admin Account Profile */}
          {adminTab === 'account' && <StaffAccountView />}
        </AdminLayout>
      )}

      {loginModalOpen && (
        <LoginModal
          isOpen={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          defaultTab={loginDefaultTab}
        />
      )}
    </div>
  );
};
