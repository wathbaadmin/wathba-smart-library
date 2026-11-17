import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { NotificationBell } from './NotificationBell';
import { Button } from './Button';
import { QrCode, LogOut, ShieldCheck, UserCheck, BookOpen, GraduationCap } from 'lucide-react';

interface NavbarProps {
  onOpenScanner?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenScanner, activeTab, setActiveTab }) => {
  const { authMode, currentStudent, currentStaff, logout } = useAuth();
  const { settings } = useLibrary();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-wathba-700 via-wathba-600 to-emerald-400 flex items-center justify-center text-white shadow-soft shadow-wathba-600/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-slate-900 tracking-tight">
                  {settings.libraryName}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {settings.teamName}
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-400 block tracking-wide">
                {settings.libraryEnglishName}
              </span>
            </div>
          </div>

          {/* Quick Nav Links (for Supervisor/Admin) */}
          {(authMode === 'admin' || authMode === 'supervisor') && setActiveTab && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-white text-wathba-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                لوحة التحكم
              </button>
              <button
                onClick={() => setActiveTab('smart-scan')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'smart-scan'
                    ? 'bg-wathba-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                المسح الذكي
              </button>
              <button
                onClick={() => setActiveTab('books')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'books'
                    ? 'bg-white text-wathba-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكتب والنسخ
              </button>
              <button
                onClick={() => setActiveTab('distribution')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'distribution'
                    ? 'bg-white text-wathba-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                التوزيع الجماعي
              </button>
              <button
                onClick={() => setActiveTab('shelf')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'shelf'
                    ? 'bg-white text-wathba-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                رف الإرجاع والفحص
              </button>
              {authMode === 'admin' && (
                <>
                  <button
                    onClick={() => setActiveTab('students')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'students'
                        ? 'bg-white text-wathba-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الطلاب
                  </button>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'inventory'
                        ? 'bg-white text-wathba-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الجرد
                  </button>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'reports'
                        ? 'bg-white text-wathba-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    التقارير
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'settings'
                        ? 'bg-white text-wathba-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الإعدادات
                  </button>
                </>
              )}
            </nav>
          )}

          {/* Right Controls: Role Badge, Quick Scanner, Notifications, Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Scanner Shortcut for Staff */}
            {(authMode === 'admin' || authMode === 'supervisor') && onOpenScanner && (
              <Button
                variant="primary"
                size="sm"
                icon={<QrCode className="w-4 h-4" />}
                onClick={onOpenScanner}
                className="hidden sm:inline-flex"
              >
                المسح بالكاميرا
              </Button>
            )}

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Profile / Status */}
            {authMode === 'student' && currentStudent && (
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200">
                <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="text-right">
                  <div className="text-xs font-bold leading-tight">{currentStudent.fullName}</div>
                  <div className="text-[10px] text-emerald-700">{currentStudent.grade} • {currentStudent.groupName}</div>
                </div>
                <button
                  onClick={() => logout()}
                  className="mr-1 p-1 text-emerald-700 hover:text-rose-600 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {(authMode === 'admin' || authMode === 'supervisor') && currentStaff && (
              <div className="flex items-center gap-2 bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200">
                <ShieldCheck className="w-4 h-4 text-royal-600 shrink-0" />
                <div className="text-right">
                  <div className="text-xs font-bold leading-tight">{currentStaff.fullName}</div>
                  <div className="text-[10px] text-slate-500">
                    {currentStaff.role === 'admin' ? 'المدير العام' : 'مشرف معتمد'}
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  className="mr-1 p-1 text-slate-400 hover:text-rose-600 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {authMode === 'guest' && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('official-login-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  دخول الطالب
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById('official-login-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  دخول المشرف
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
