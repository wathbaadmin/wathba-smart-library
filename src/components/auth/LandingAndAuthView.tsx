import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { Button } from '../common/Button';
import { MidadLogo } from '../common/MidadLogo';
import { StudentCardScannerModal } from './StudentCardScannerModal';
import {
  GraduationCap,
  ShieldCheck,
  Shield,
  KeyRound,
  User,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  Hash,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  QrCode,
  Camera,
  ScanLine,
  BookOpen,
  Award,
  Layers,
  ArrowRight,
  HelpCircle,
  Check,
  Trophy,
  X,
} from 'lucide-react';

export const LandingAndAuthView: React.FC = () => {
  const { loginAsStudent, loginAsStaff, sessionNotice, clearSessionNotice } = useAuth();
  const { settings } = useLibrary();
  const { showToast } = useNotifications();

  const [selectedDoor, setSelectedDoor] = useState<'student' | 'supervisor' | 'admin'>('student');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // بوابة الطالب: الدخول بالباركود (QR) أو الدخول بالرمز
  const [studentLoginMethod, setStudentLoginMethod] = useState<'qr' | 'code'>('qr');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [studentCode, setStudentCode] = useState('');
  const [studentPin, setStudentPin] = useState('');
  const [showStudentPin, setShowStudentPin] = useState(false);

  // نموذج المشرف
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [showSupPass, setShowSupPass] = useState(false);

  // نموذج الإدارة
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

  // مؤقت التقييد الزمني
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldownSeconds]);

  const switchDoor = (door: 'student' | 'supervisor' | 'admin') => {
    setSelectedDoor(door);
    setErrorMsg(null);
    clearSessionNotice();
  };

  // معالجة دخول الطالب بالرمز
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    clearSessionNotice();

    if (!studentCode.trim() || !studentPin.trim()) {
      setErrorMsg('يرجى إدخال كود الطالب ورمز الدخول.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAsStudent(studentCode, studentPin);
      if (res.success) {
        setStudentPin('');
        showToast(
          `مرحباً بك في ${settings.libraryName || 'مكتبة مداد الذكية'}${res.student ? `، ${res.student.fullName}` : ''}`,
          'success',
          'تم تسجيل الدخول بنجاح'
        );
      } else {
        setErrorMsg(res.error || 'بيانات الدخول غير صحيحة. يرجى التحقق من كود الطالب ورمز الدخول.');
        if (res.retryAfterSeconds) {
          setCooldownSeconds(res.retryAfterSeconds);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // معالجة دخول المشرف
  const handleSupervisorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    clearSessionNotice();

    if (!supervisorUsername.trim() || !supervisorPassword.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم وكلمة المرور الخاصة بالمشرف.');
      return;
    }

    const res = loginAsStaff(supervisorUsername, supervisorPassword, 'supervisor');
    if (res.success) {
      setSupervisorPassword('');
      showToast('تم تسجيل الدخول إلى لوحة المشرف بنجاح.', 'success');
    } else {
      setErrorMsg(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
      if (res.retryAfterSeconds) setCooldownSeconds(res.retryAfterSeconds);
    }
  };

  // معالجة دخول الإدارة العامة
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    clearSessionNotice();

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم الإداري وكلمة المرور.');
      return;
    }

    const res = loginAsStaff(adminUsername, adminPassword, 'admin');
    if (res.success) {
      setAdminPassword('');
      showToast('مرحباً بك في لوحة الإدارة العامة.', 'success');
    } else {
      setErrorMsg(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
      if (res.retryAfterSeconds) setCooldownSeconds(res.retryAfterSeconds);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a181e] font-arabic text-slate-800 flex flex-col lg:flex-row overflow-x-hidden selection:bg-teal-500 selection:text-white"
    >
      {/* =========================================================================
          الجانب الأيمن: الواجهة المؤسسية الفخمة والهوية البصرية لمكتبة مداد
          ========================================================================= */}
      <aside className="lg:w-[50%] xl:w-[52%] bg-gradient-to-br from-[#071419] via-[#0d222b] to-[#153440] text-white p-6 sm:p-10 lg:p-16 flex flex-col justify-between relative overflow-hidden shrink-0 border-b lg:border-b-0 lg:border-l border-white/10">
        {/* خلفية جمالية فائقة النقاء: إضاءات ضبابية ناعمة وشبكة متناسقة */}
        <div className="absolute -top-32 -right-32 w-[32rem] h-[32rem] bg-teal-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -left-36 w-[28rem] h-[28rem] bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-[24rem] h-[24rem] bg-cyan-600/10 rounded-full blur-[90px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20px 20px, #ffffff 1.2px, transparent 0)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* الجزء العلوي: الشعار الرسمي المعتمد والشارة التنظيمية */}
        <div className="relative z-10 space-y-8 lg:space-y-12">
          {/* الشعار الشفاف 100% بنقاء فائق دون أي إطار أو خلفية بيضاء */}
          <div className="flex items-center justify-between gap-4">
            <div className="inline-block transition-transform hover:scale-[1.02] duration-300">
              <MidadLogo variant="full" theme="white" size="xl" className="h-16 sm:h-20 lg:h-24 w-auto drop-shadow-sm" />
            </div>

            <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.07] border border-white/10 backdrop-blur-md text-xs font-bold text-emerald-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>المنصة المعتمدة للتحول الرقمي القرائي</span>
            </div>
          </div>

          {/* العنوان المؤسسي والرسالة الرؤيوية */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-400/10 border border-teal-300/20 text-xs font-bold text-teal-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>بيئة مدرسية ذكية ومتكاملة</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-white leading-[1.25] tracking-tight">
              أهلاً بكم في منظومة{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-emerald-300 via-teal-200 to-white">
                {settings.libraryName || 'مكتبة مداد الذكية'}
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300/90 leading-relaxed max-w-xl font-medium">
              المنظومة المتطورة لإدارة المكتبة المدرسية؛ تجمع بين سرعة الدخول الفوري ببطاقات الـ QR، حوكمة عمليات الإعارة وفهرسة النسخ، وصناعة الشغف المعرفي عبر حلقات المناقشة والتحديات التفاعلية.
            </p>
          </div>

          {/* الركائز الأساسية للمنصة (3 ميزات بتصميم زجاجي خفيف وأنيق بدون صناديق ثقيلة) */}
          <div className="grid grid-cols-1 gap-3 pt-2 max-w-xl">
            {/* الركيزة 1 */}
            <div className="group flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 transition-all duration-300 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 border border-teal-400/30 flex items-center justify-center shrink-0 text-teal-300 group-hover:scale-110 transition-transform">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <span>الدخول الذكي ببطاقة الـ QR</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">فوري</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  تسجيل دخول مباشر للطلاب في ثانية واحدة عبر مسح الباركود بالكاميرا دون الحاجة لحفظ كلمات مرور.
                </p>
              </div>
            </div>

            {/* الركيزة 2 */}
            <div className="group flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 transition-all duration-300 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 text-cyan-300 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-black text-white">إدارة الفهرس والإعارة الحية</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  متابعة دقيقة لحالات الكتب والنسخ المادية، فحص الإرجاع، وتنبيهات الاستحقاق التلقائية.
                </p>
              </div>
            </div>

            {/* الركيزة 3 */}
            <div className="group flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 transition-all duration-300 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300 group-hover:scale-110 transition-transform">
                <Award className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-black text-white">المناقشات القرائية ورصيد النقاط</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  جلسات حوارية مع المشرفين، معايير تقييم معتمدة، وأوسمة تحفيزية تشجع الطلاب على التميز.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* الشريط السفلي للتوثيق والاعتماد والأمان */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-8 mt-6 border-t border-white/10 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>نظام مؤمّن بتشفير الجلسات وسجلات التدقيق الميداني</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] bg-white/[0.06] border border-white/10 px-3 py-1 rounded-lg text-slate-200">
            <Clock className="w-3.5 h-3.5 text-teal-300" />
            <span>توقيت الرياض (Asia/Riyadh)</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          الجانب الأيسر: بوابة الدخول التفاعلية الحديثة
          ========================================================================= */}
      <main className="flex-1 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e7eef4] flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 relative">
        <div className="w-full max-w-md space-y-5">
          {/* شعار مصغر للأجهزة المحمولة فقط */}
          <div className="lg:hidden text-center pb-2">
            <div className="inline-block">
              <MidadLogo variant="full" theme="dark" size="lg" className="h-14 w-auto mx-auto" />
            </div>
          </div>

          {/* مبدل البوابات الموحد (Role Selector Segmented Control) */}
          <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => switchDoor('student')}
              className={`min-h-[46px] px-2 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                selectedDoor === 'student'
                  ? 'bg-gradient-to-r from-[#142e38] to-[#1e414f] text-white shadow-md shadow-teal-950/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>الطالب</span>
            </button>

            <button
              type="button"
              onClick={() => switchDoor('supervisor')}
              className={`min-h-[46px] px-2 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                selectedDoor === 'supervisor'
                  ? 'bg-gradient-to-r from-[#142e38] to-[#1e414f] text-white shadow-md shadow-teal-950/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>المشرف</span>
            </button>

            <button
              type="button"
              onClick={() => switchDoor('admin')}
              className={`min-h-[46px] px-2 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                selectedDoor === 'admin'
                  ? 'bg-gradient-to-r from-[#0f172a] to-[#1e293b] text-white shadow-md shadow-slate-950/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>الإدارة</span>
            </button>
          </div>

          {/* تنبيه انتهاء الجلسة إن وجد */}
          {sessionNotice && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-start gap-2.5 animate-in fade-in">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{sessionNotice}</span>
            </div>
          )}

          {/* شريط الأخطاء والتقييد الزمني */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2.5 animate-in fade-in duration-150"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span>{errorMsg}</span>
                {cooldownSeconds > 0 && (
                  <span className="block text-[11px] font-mono text-rose-700">
                    الوقت المتبقي للمحاولة التالية: {cooldownSeconds} ثانية
                  </span>
                )}
              </div>
            </div>
          )}

          {/* بطاقة الدخول الموحدة الفاخرة */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-[0_20px_50px_rgba(15,23,42,0.06)] space-y-6">
            {/* =================================================================
                1. بوابة الطالب (باركود QR + الدخول بالرمز)
                ================================================================= */}
            {selectedDoor === 'student' && (
              <>
                <div className="space-y-1.5 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5 text-[#142e38]">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#142e38] border border-teal-100 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">بوابة تسجيل دخول الطالب</h2>
                      <p className="text-xs text-slate-500">
                        اختر طريقة الدخول المناسبة عبر <strong>الباركود (QR)</strong> أو <strong>الرمز</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* مبدل طريقتي الدخول للطالب (QR مقابل الرمز) */}
                <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100/80 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setStudentLoginMethod('qr');
                      setErrorMsg(null);
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      studentLoginMethod === 'qr'
                        ? 'bg-white text-[#142e38] shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-teal-700" />
                    <span>الدخول بالباركود (QR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudentLoginMethod('code');
                      setErrorMsg(null);
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                      studentLoginMethod === 'code'
                        ? 'bg-white text-[#142e38] shadow-sm border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <KeyRound className="w-4 h-4 text-teal-700" />
                    <span>الدخول بالرمز</span>
                  </button>
                </div>

                {/* نمط 1: الدخول بالباركود (QR) */}
                {studentLoginMethod === 'qr' ? (
                  <div className="space-y-4">
                    {settings.enableStudentQrLogin === false ? (
                      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 text-center">
                        <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                        <div className="space-y-1">
                          <h3 className="font-black text-sm">الدخول بالباركود معطّل مؤقتاً</h3>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            تم إيقاف ميزة الدخول عبر الباركود من الإعدادات. يمكنك الدخول عبر الرمز مباشرة.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          icon={<KeyRound className="w-4 h-4" />}
                          onClick={() => setStudentLoginMethod('code')}
                          className="w-full"
                        >
                          الانتقال إلى الدخول بالرمز
                        </Button>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl bg-gradient-to-b from-[#f8fafc] via-[#f4f7fa] to-[#edf3f7] border border-slate-200 text-center space-y-5 relative overflow-hidden">
                        {/* الإطار التقني التفاعلي لمسح الـ QR */}
                        <div className="relative w-24 h-24 mx-auto rounded-3xl bg-white border-2 border-teal-600/30 shadow-md flex items-center justify-center group">
                          {/* تأثير رادار المسح */}
                          <div className="absolute inset-2 border border-dashed border-teal-500/50 rounded-2xl" />
                          <QrCode className="w-12 h-12 text-[#142e38] transition-transform group-hover:scale-110 duration-300" />
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                          </span>
                        </div>

                        <div className="space-y-1.5 max-w-xs mx-auto">
                          <h3 className="text-base font-black text-[#142e38]">
                            الدخول السريع ببطاقة الطالب الذكية
                          </h3>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            وجّه باركود بطاقتك المدرسية نحو كاميرا الجهاز وسيتم تسجيل دخولك فوراً دون كتابة كلمة سر.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="primary"
                          size="lg"
                          icon={<Camera className="w-5 h-5" />}
                          onClick={() => setQrScannerOpen(true)}
                          className="w-full shadow-lg shadow-teal-900/20 text-sm font-black py-3.5 bg-gradient-to-r from-[#142e38] to-[#1e4655] hover:from-[#193a46] hover:to-[#255567]"
                        >
                          تشغيل الكاميرا ومسح الباركود
                        </Button>

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setStudentLoginMethod('code')}
                            className="text-xs text-teal-700 hover:text-teal-900 font-bold hover:underline transition-all"
                          >
                            أو الدخول يدوياً عبر كود الطالب ورمز الدخول ←
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* نمط 2: الدخول بالرمز */
                  <form onSubmit={handleStudentSubmit} noValidate className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="student-code-input"
                        className="block text-xs font-bold text-slate-800"
                      >
                        كود الطالب
                      </label>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-teal-700 absolute right-3.5 top-4 pointer-events-none" />
                        <input
                          id="student-code-input"
                          type="text"
                          dir="ltr"
                          autoComplete="username"
                          autoCapitalize="characters"
                          value={studentCode}
                          onChange={(e) => {
                            setStudentCode(e.target.value);
                            if (errorMsg) setErrorMsg(null);
                          }}
                          placeholder="STU-1001"
                          className="w-full min-h-[48px] pr-10 pl-4 py-3 text-sm font-mono font-black tracking-wider rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-700 focus:border-teal-700 focus:outline-none text-left uppercase transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="student-pin-input"
                        className="block text-xs font-bold text-slate-800"
                      >
                        رمز الدخول (PIN)
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-teal-700 absolute right-3.5 top-4 pointer-events-none" />
                        <input
                          id="student-pin-input"
                          type={showStudentPin ? 'text' : 'password'}
                          dir="ltr"
                          autoComplete="current-password"
                          value={studentPin}
                          onChange={(e) => {
                            setStudentPin(e.target.value);
                            if (errorMsg) setErrorMsg(null);
                          }}
                          placeholder="••••••"
                          className="w-full min-h-[48px] pr-10 pl-12 py-3 text-sm font-mono font-black tracking-widest rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-700 focus:border-teal-700 focus:outline-none text-left transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowStudentPin((v) => !v)}
                          className="absolute left-1 top-1 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-teal-800 hover:bg-slate-100 transition-colors"
                          aria-label={showStudentPin ? 'إخفاء رمز الدخول' : 'إظهار رمز الدخول'}
                        >
                          {showStudentPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={submitting}
                      disabled={cooldownSeconds > 0}
                      icon={<ArrowLeft className="w-4 h-4" />}
                      className="w-full mt-2 font-black shadow-md bg-gradient-to-r from-[#142e38] to-[#1e4655]"
                    >
                      تسجيل الدخول بالرمز
                    </Button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setStudentLoginMethod('qr')}
                        className="text-xs text-slate-500 hover:text-[#142e38] font-bold transition-all"
                      >
                        العودة للمسح السريع بالباركود (QR)
                      </button>
                    </div>
                  </form>
                )}

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed text-center">
                  في حال فقدان كود الطالب أو بطاقة الباركود، يُرجى مراجعة مشرف المكتبة لإعادة إصدارها.
                </div>

                {/* نافذة تصوير الباركود الذكية */}
                <StudentCardScannerModal
                  isOpen={qrScannerOpen}
                  onClose={() => setQrScannerOpen(false)}
                  onSwitchToCode={() => {
                    setQrScannerOpen(false);
                    setStudentLoginMethod('code');
                  }}
                />
              </>
            )}

            {/* =================================================================
                2. بوابة مشرف المكتبة
                ================================================================= */}
            {selectedDoor === 'supervisor' && (
              <>
                <div className="space-y-1.5 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5 text-[#142e38]">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#142e38] border border-teal-100 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">بوابة مشرف المكتبة</h2>
                      <p className="text-xs text-slate-500">
                        متابعة الإعارة الميدانية، فحص النسخ، وتقييم المناقشات القرائية
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSupervisorSubmit} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="sup-username-input"
                      className="block text-xs font-bold text-slate-800"
                    >
                      اسم المستخدم للمشرف
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-4 pointer-events-none" />
                      <input
                        id="sup-username-input"
                        type="text"
                        dir="ltr"
                        autoComplete="username"
                        value={supervisorUsername}
                        onChange={(e) => {
                          setSupervisorUsername(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder="supervisor1"
                        className="w-full min-h-[48px] pr-10 pl-4 py-3 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#142e38] focus:border-[#142e38] focus:outline-none text-left transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="sup-pass-input"
                      className="block text-xs font-bold text-slate-800"
                    >
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-4 pointer-events-none" />
                      <input
                        id="sup-pass-input"
                        type={showSupPass ? 'text' : 'password'}
                        dir="ltr"
                        autoComplete="current-password"
                        value={supervisorPassword}
                        onChange={(e) => {
                          setSupervisorPassword(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder="••••••••"
                        className="w-full min-h-[48px] pr-10 pl-12 py-3 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#142e38] focus:border-[#142e38] focus:outline-none text-left transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSupPass((v) => !v)}
                        className="absolute left-1 top-1 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#142e38] hover:bg-slate-100"
                        aria-label={showSupPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showSupPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={cooldownSeconds > 0}
                    icon={<ShieldCheck className="w-4 h-4" />}
                    className="w-full mt-2 font-black shadow-md bg-gradient-to-r from-[#142e38] to-[#1e4655]"
                  >
                    دخول لوحة المشرف
                  </Button>
                </form>
              </>
            )}

            {/* =================================================================
                3. بوابة الإدارة العامة
                ================================================================= */}
            {selectedDoor === 'admin' && (
              <>
                <div className="space-y-1.5 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5 text-[#0f172a]">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#0f172a] border border-slate-200 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">بوابة الإدارة العامة</h2>
                      <p className="text-xs text-slate-500">
                        تحكم شامل بالفهرس، الحسابات، صلاحيات النظام، والإعدادات المتقدمة
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleAdminSubmit} noValidate className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-username-input"
                      className="block text-xs font-bold text-slate-800"
                    >
                      اسم المستخدم الإداري
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-4 pointer-events-none" />
                      <input
                        id="admin-username-input"
                        type="text"
                        dir="ltr"
                        autoComplete="username"
                        value={adminUsername}
                        onChange={(e) => {
                          setAdminUsername(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder="admin"
                        className="w-full min-h-[48px] pr-10 pl-4 py-3 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#0f172a] focus:border-[#0f172a] focus:outline-none text-left transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-pass-input"
                      className="block text-xs font-bold text-slate-800"
                    >
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-4 pointer-events-none" />
                      <input
                        id="admin-pass-input"
                        type={showAdminPass ? 'text' : 'password'}
                        dir="ltr"
                        autoComplete="current-password"
                        value={adminPassword}
                        onChange={(e) => {
                          setAdminPassword(e.target.value);
                          if (errorMsg) setErrorMsg(null);
                        }}
                        placeholder="••••••••"
                        className="w-full min-h-[48px] pr-10 pl-12 py-3 text-sm font-mono font-bold rounded-xl border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-[#0f172a] focus:border-[#0f172a] focus:outline-none text-left transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass((v) => !v)}
                        className="absolute left-1 top-1 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#0f172a] hover:bg-slate-100"
                        aria-label={showAdminPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="royal"
                    size="lg"
                    disabled={cooldownSeconds > 0}
                    icon={<Shield className="w-4 h-4" />}
                    className="w-full mt-2 font-black shadow-md bg-gradient-to-r from-[#0f172a] to-[#1e293b]"
                  >
                    دخول لوحة الإدارة العامة
                  </Button>
                </form>
              </>
            )}
          </div>

          {/* تذييل الواجهة الأنيق */}
          <div className="text-center text-xs text-slate-400 space-y-1">
            <p>منظومة مداد الذكية لإدارة المكتبات المدرسية • MIDAD Smart Library</p>
            <p className="text-[11px] text-slate-400/80">الإصدار 2.5 • جميع الحقوق محفوظة</p>
          </div>
        </div>
      </main>
    </div>
  );
};
