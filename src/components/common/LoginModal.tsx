import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from './Button';
import { MidadLogo } from './MidadLogo';
import { StudentCardScannerModal } from '../auth/StudentCardScannerModal';
import {
  BookOpen,
  GraduationCap,
  ShieldCheck,
  KeyRound,
  Hash,
  User,
  Lock,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  QrCode,
  Camera,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultTab?: 'student' | 'staff';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'student',
}) => {
  const { loginAsStudent, loginAsStaff } = useAuth();
  const { settings } = useLibrary();
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<'student' | 'staff'>(defaultTab);
  const [studentMethod, setStudentMethod] = useState<'qr' | 'code'>('qr');
  const [studentCode, setStudentCode] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showStaffPass, setShowStaffPass] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTab);
    setError(null);
  }, [defaultTab, isOpen]);

  if (!isOpen) return null;

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!studentCode.trim() || !accessCode.trim()) {
      setError('يرجى إدخال كود الطالب ورمز الدخول.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginAsStudent(studentCode, accessCode);
      if (res.success) {
        setAccessCode('');
        showToast('مرحباً بك في مكتبة وثبة الذكية', 'success');
        onClose?.();
      } else {
        setError(res.error || 'بيانات الدخول غير صحيحة.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = loginAsStaff(username, password);
    if (res.success) {
      setPassword('');
      showToast(
        `أهلاً بك! تم تسجيل الدخول بصلاحية: ${res.role === 'admin' ? 'الإدارة العامة' : 'المشرف'}`,
        'success'
      );
      onClose?.();
    } else {
      setError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-premium border border-[#dde6ed] overflow-hidden my-auto">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 left-3.5 z-10 min-w-[40px] min-h-[40px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="p-6 bg-gradient-to-l from-[#1c353d] via-[#2b5460] to-[#3b707d] text-white text-center">
          <div className="inline-flex items-center justify-center mx-auto mb-2">
            <MidadLogo variant="mark" theme="white" size="sm" className="h-10 w-auto" />
          </div>
          <h2 className="text-lg font-black">{settings.libraryName || 'مكتبة مداد الذكية'}</h2>
          <p className="text-xs text-[#dce8ee] mt-0.5">بوابة الدخول الموحّدة</p>

          <div className="mt-4 grid grid-cols-2 gap-1.5 bg-black/20 p-1 rounded-2xl text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('student');
                setError(null);
              }}
              className={`min-h-[40px] py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'student'
                  ? 'bg-white text-[#284d57] shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>دخول الطالب</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('staff');
                setError(null);
              }}
              className={`min-h-[40px] py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'staff'
                  ? 'bg-white text-[#284d57] shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>المشرف / الإدارة</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'student' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#f4f7f9] border border-[#dde6ed]">
                <button
                  type="button"
                  onClick={() => {
                    setStudentMethod('qr');
                    setError(null);
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    studentMethod === 'qr'
                      ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-[#3b707d]" />
                  <span>الدخول بالباركود</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentMethod('code');
                    setError(null);
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                    studentMethod === 'code'
                      ? 'bg-white text-[#1c353d] shadow-sm border border-[#dde6ed]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#3b707d]" />
                  <span>الدخول بالرمز</span>
                </button>
              </div>

              {studentMethod === 'qr' ? (
                <div className="text-center">
                  {settings.enableStudentQrLogin === false ? (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5">
                      <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                      <p className="text-xs font-black">الدخول بالباركود معطّل مؤقتاً</p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        تم إيقاف الدخول عبر الباركود مؤقتاً من إعدادات إدارة المكتبة. يمكنك الدخول مباشرة بالرمز.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={<KeyRound className="w-3.5 h-3.5" />}
                        onClick={() => setStudentMethod('code')}
                        className="w-full"
                      >
                        الانتقال إلى الدخول بالرمز
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#f4f7f9] border border-[#dde6ed] space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-[#e3ecf3] border border-[#c5d8df] text-[#3b707d] flex items-center justify-center mx-auto shadow-sm">
                        <QrCode className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-black text-[#1c353d]">الدخول السريع ببطاقة الطالب (QR)</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          اضغط على الزر أدناه لتشغيل الكاميرا ومسح باركود بطاقتك لتسجيل الدخول تلقائياً.
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        icon={<Camera className="w-4 h-4" />}
                        onClick={() => setQrOpen(true)}
                        className="w-full"
                      >
                        الدخول عن طريق الباركود
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleStudentSubmit} noValidate className="space-y-4 text-right">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">كود الطالب:</label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-[#3b707d] absolute right-3.5 top-3.5" />
                      <input
                        type="text"
                        dir="ltr"
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        placeholder="STU-1001"
                        className="w-full min-h-[44px] pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-left uppercase focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رمز الدخول:</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#3b707d] absolute right-3.5 top-3.5" />
                      <input
                        type={showPin ? 'text' : 'password'}
                        dir="ltr"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        placeholder="••••••"
                        className="w-full min-h-[44px] pr-10 pl-11 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-left tracking-widest focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin((v) => !v)}
                        className="absolute left-1 top-1 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#3b707d]"
                        aria-label={showPin ? 'إخفاء رمز الدخول' : 'إظهار رمز الدخول'}
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" variant="primary" loading={submitting} className="w-full" size="md">
                    تسجيل الدخول بالرمز
                  </Button>
                </form>
              )}

              <StudentCardScannerModal
                isOpen={qrOpen}
                onClose={() => setQrOpen(false)}
                onSuccess={() => {
                  setQrOpen(false);
                  onClose?.();
                }}
                onSwitchToCode={() => {
                  setQrOpen(false);
                  setStudentMethod('code');
                }}
              />
            </div>
          ) : (
            <form onSubmit={handleStaffSubmit} noValidate className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم:</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  <input
                    type="text"
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="w-full min-h-[44px] pr-10 pl-3 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-left focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  <input
                    type={showStaffPass ? 'text' : 'password'}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] pr-10 pl-11 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-left focus:ring-2 focus:ring-[#3b707d] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPass((v) => !v)}
                    className="absolute left-1 top-1 min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#3b707d]"
                    aria-label={showStaffPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showStaffPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full" size="md">
                دخول لوحة العمل
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
