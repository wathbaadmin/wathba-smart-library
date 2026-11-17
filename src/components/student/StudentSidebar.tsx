import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { MidadLogo } from '../common/MidadLogo';
import {
  Home,
  BookOpen,
  BookMarked,
  Clock,
  History,
  MessageSquareText,
  Award,
  Trophy,
  MessageSquare,
  RotateCcw,
  User,
  LogOut,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileQuestion,
} from 'lucide-react';

export type StudentTab =
  | 'home'
  | 'catalog'
  | 'my_books'
  | 'my_reservations'
  | 'reading_history'
  | 'my_discussions'
  | 'ranks_certificates'
  | 'my_achievements'
  | 'my_exams'
  | 'chat'
  | 'my_requests'
  | 'my_profile';

export const getStudentTabLabel = (tab: StudentTab): string => {
  const map: Record<StudentTab, string> = {
    home: 'لوحة الطالب',
    catalog: 'استكشاف الكتب',
    my_books: 'كتبي المستعارة',
    my_reservations: 'حجوزاتي',
    reading_history: 'سجل قراءاتي',
    my_discussions: 'مناقشاتي القرائية',
    ranks_certificates: 'ألقابي وشهاداتي',
    my_achievements: 'الإنجازات والتنافس القرائي',
    my_exams: 'اختباراتي',
    chat: 'المحادثات',
    my_requests: 'طلباتي',
    my_profile: 'بياناتي والحساب',
  };
  return map[tab] || 'بوابة الطالب';
};

interface StudentNavGroup {
  id: string;
  label: string;
  defaultOpen?: boolean;
  items: {
    id: StudentTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[];
}

interface StudentSidebarProps {
  activeTab: StudentTab;
  setActiveTab: (tab: StudentTab) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeLoansCount: number;
  pendingReservationsCount: number;
  scheduledDiscussionsCount: number;
  unreadMessagesCount: number;
  activeRequestsCount: number;
}

export const StudentSidebar: React.FC<StudentSidebarProps> = ({
  activeTab,
  setActiveTab,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  activeLoansCount,
  pendingReservationsCount,
  scheduledDiscussionsCount,
  unreadMessagesCount,
  activeRequestsCount,
}) => {
  const { currentStudent, logout } = useAuth();
  const { settings } = useLibrary();

  const groups: StudentNavGroup[] = [
    {
      id: 'home',
      label: 'الرئيسية',
      defaultOpen: true,
      items: [
        { id: 'home', label: 'لوحة الطالب', icon: <Home className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      id: 'library',
      label: 'المكتبة',
      defaultOpen: true,
      items: [
        { id: 'catalog', label: 'استكشاف الكتب', icon: <BookOpen className="w-[18px] h-[18px]" /> },
        {
          id: 'my_books',
          label: 'كتبي المستعارة',
          icon: <BookMarked className="w-[18px] h-[18px]" />,
          badge: activeLoansCount,
        },
        {
          id: 'my_reservations',
          label: 'حجوزاتي',
          icon: <Clock className="w-[18px] h-[18px]" />,
          badge: pendingReservationsCount,
        },
        { id: 'reading_history', label: 'سجل قراءاتي', icon: <History className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      id: 'achievements',
      label: 'الإنجازات والتنافس',
      defaultOpen: true,
      items: [
        { id: 'my_achievements', label: 'لوحة الشرف والإنجازات', icon: <Trophy className="w-[18px] h-[18px]" /> },
        { id: 'ranks_certificates', label: 'ألقابي وشهاداتي', icon: <Award className="w-[18px] h-[18px]" /> },
        {
          id: 'my_discussions',
          label: 'مناقشاتي',
          icon: <MessageSquareText className="w-[18px] h-[18px]" />,
          badge: scheduledDiscussionsCount,
        },
        { id: 'my_exams', label: 'اختباراتي', icon: <FileQuestion className="w-[18px] h-[18px]" /> },
      ],
    },
    {
      id: 'comms',
      label: 'التواصل',
      defaultOpen: true,
      items: [
        {
          id: 'chat',
          label: 'المحادثات',
          icon: <MessageSquare className="w-[18px] h-[18px]" />,
          badge: unreadMessagesCount,
        },
        {
          id: 'my_requests',
          label: 'طلباتي',
          icon: <RotateCcw className="w-[18px] h-[18px]" />,
          badge: activeRequestsCount,
        },
      ],
    },
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const grp = groups.find((g) => g.items.some((i) => i.id === activeTab));
    if (grp && openGroups[grp.id] === false) {
      setOpenGroups((prev) => ({ ...prev, [grp.id]: true }));
    }
  }, [activeTab]);

  const isGroupOpen = (g: StudentNavGroup) => {
    if (openGroups[g.id] !== undefined) return openGroups[g.id];
    if (g.items.some((i) => i.id === activeTab)) return true;
    return g.defaultOpen !== false;
  };

  const toggleGroup = (g: StudentNavGroup) => {
    setOpenGroups((prev) => ({ ...prev, [g.id]: !isGroupOpen(g) }));
  };

  const handleSelect = (tab: StudentTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  const renderSidebarBody = (mobileDrawer: boolean) => {
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
                  بوابة الطالب
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="توسيع القائمة"
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

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3" aria-label="قائمة الطالب">
          {groups.map((grp) => {
            const expanded = compact ? true : isGroupOpen(grp);
            return (
              <div key={grp.id} className="space-y-1">
                {!compact ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp)}
                    className="w-full px-2.5 py-1 flex items-center justify-between text-[11px] font-black text-slate-400 hover:text-[#3b707d]"
                  >
                    <span>{grp.label}</span>
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
                    {grp.items.map((item) => {
                      const active = activeTab === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(item.id)}
                            title={compact ? item.label : undefined}
                            className={`w-full relative flex items-center ${
                              compact ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                            } rounded-xl text-xs font-bold transition-all ${
                              active
                                ? 'bg-[#e3ecf3]/85 text-[#1c353d] font-black'
                                : 'text-slate-600 hover:bg-[#f4f7f9] hover:text-[#1c353d]'
                            }`}
                          >
                            {active && (
                              <span
                                aria-hidden="true"
                                className="absolute right-0 top-1.5 bottom-1.5 w-[3px] rounded-l-full bg-[#3b707d]"
                              />
                            )}
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={active ? 'text-[#3b707d]' : 'text-slate-400'}>
                                {item.icon}
                              </span>
                              {!compact && <span className="truncate">{item.label}</span>}
                            </div>
                            {!compact && item.badge && item.badge > 0 ? (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-[#e3ecf3] text-[#1c353d] border border-[#c5d8df]">
                                {item.badge > 99 ? '+99' : item.badge}
                              </span>
                            ) : null}
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

        {/* Pinned Account Section */}
        <div className="p-2.5 border-t border-[#dde6ed] bg-[#f4f7f9]/60 space-y-1.5 shrink-0">
          {!compact ? (
            <>
              <div className="px-2 py-0.5 text-[10px] font-black text-slate-400">الحساب</div>
              <button
                type="button"
                onClick={() => handleSelect('my_profile')}
                className={`w-full p-2.5 rounded-xl flex items-center gap-2.5 text-right transition-colors ${
                  activeTab === 'my_profile'
                    ? 'bg-white border border-[#3b707d]/30 text-[#1c353d]'
                    : 'hover:bg-white text-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#3b707d] text-white flex items-center justify-center font-black text-xs shrink-0">
                  {currentStudent?.fullName.charAt(0) || 'ط'}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-[#1c353d] block truncate">
                    {currentStudent?.fullName || 'بياناتي'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono block truncate" dir="ltr">
                    {currentStudent?.internalId}
                  </span>
                </div>
                <User className="w-4 h-4 text-slate-400 shrink-0" />
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
                onClick={() => handleSelect('my_profile')}
                title="بياناتي"
                className="w-9 h-9 rounded-lg bg-[#3b707d] text-white flex items-center justify-center font-black text-xs"
              >
                {currentStudent?.fullName.charAt(0) || 'ط'}
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
      <aside
        className={`hidden lg:block shrink-0 h-screen sticky top-0 z-30 transition-all duration-200 ${
          isCollapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1c353d]/45 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[84%] max-w-[300px] h-full shadow-2xl">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
