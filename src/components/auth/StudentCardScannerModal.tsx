import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Student } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  QrCode,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  SwitchCamera,
  X,
} from 'lucide-react';

interface StudentCardScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (student: Student) => void;
  onSwitchToCode?: () => void;
}

type ScanPhase = 'scanning' | 'verifying' | 'pin_required' | 'success' | 'error';

export const StudentCardScannerModal: React.FC<StudentCardScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSwitchToCode,
}) => {
  const { loginAsStudentByQr } = useAuth();
  const { showToast } = useNotifications();

  const [scanPhase, setScanPhase] = useState<ScanPhase>('scanning');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const [detectedBadge, setDetectedBadge] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [recognizedStudent, setRecognizedStudent] = useState<Student | null>(null);

  // Extra PIN verification step (if enabled in LibrarySettings)
  const [pendingQrToken, setPendingQrToken] = useState<string>('');
  const [studentCodeHint, setStudentCodeHint] = useState<string>('');
  const [extraPin, setExtraPin] = useState('');
  const [showExtraPin, setShowExtraPin] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const verifyingLockRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);
  const viewportId = 'student-card-qr-viewport';

  const playBeep = (success = true) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 880 : 280, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch {
      // ignore browser audio restriction
    }
  };

  const stopCamera = useCallback(async () => {
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (mountedRef.current) setCameraActive(false);
    if (!instance) return;
    try {
      await instance.stop();
    } catch {
      // ignore if already stopped
    }
    try {
      instance.clear();
    } catch {
      // ignore clear errors
    }
  }, []);

  const handleCloseClean = useCallback(async () => {
    verifyingLockRef.current = false;
    await stopCamera();
    onClose();
  }, [onClose, stopCamera]);

  const handleSwitchToCode = useCallback(async () => {
    await handleCloseClean();
    if (onSwitchToCode) onSwitchToCode();
  }, [handleCloseClean, onSwitchToCode]);

  const verifyScannedToken = useCallback(
    async (rawQrText: string, pinCode?: string) => {
      if (verifyingLockRef.current) return;
      verifyingLockRef.current = true;

      setDetectedBadge(true);
      setScanError(null);
      setScanPhase('verifying');
      setStatusMessage('تم اكتشاف الباركود — جارٍ التحقق من الحساب...');

      // إيقاف الكاميرا مؤقتاً أثناء التحقق لمنع القراءات المكررة
      await stopCamera();

      try {
        const res = await loginAsStudentByQr(rawQrText, pinCode);
        if (!mountedRef.current) return;

        if (res.success && res.student) {
          playBeep(true);
          setRecognizedStudent(res.student);
          setScanPhase('success');
          setStatusMessage('تم التحقق بنجاح! جارٍ نقلك إلى لوحة الطالب...');

          showToast(
            `مرحباً بك في مكتبة وثبة الذكية، ${res.student.fullName}`,
            'success',
            'تم تسجيل الدخول بالباركود'
          );

          window.setTimeout(() => {
            if (!mountedRef.current) return;
            if (onSuccess) onSuccess(res.student!);
            onClose();
          }, 550);
          return;
        }

        // التحقق الإضافي برمز الدخول (عند تفعيله من الإدارة)
        if (res.requiresPin) {
          playBeep(true);
          setPendingQrToken(rawQrText);
          setStudentCodeHint(res.studentCodeHint || '');
          setScanPhase('pin_required');
          setScanError(res.error || null);
          setStatusMessage('تم التحقق من البطاقة — يرجى إدخال رمز الدخول لإكمال تسجيل الدخول.');
          verifyingLockRef.current = false;
          return;
        }

        playBeep(false);
        setDetectedBadge(false);
        setScanPhase('error');
        setStatusMessage(null);
        setScanError(res.error || 'تعذر التحقق من باركود الطالب.');
      } finally {
        if (mountedRef.current) {
          verifyingLockRef.current = false;
        }
      }
    },
    [loginAsStudentByQr, onClose, onSuccess, showToast, stopCamera]
  );

  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user' = facingMode) => {
      if (!isOpen) return;
      setCameraError(null);
      setScanError(null);
      setStatusMessage(null);
      setDetectedBadge(false);
      setScanPhase('scanning');

      // التحقق من بيئة HTTPS الآمنة المطلوبة للكاميرا في الجوالات
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        setCameraError(
          'تشغيل الكاميرا يتطلب فتح المنصة عبر اتصال آمن HTTPS (أو localhost). يمكنك استخدام الدخول اليدوي أو رفع صورة الباركود.'
        );
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'المتصفح أو الجهاز الحالي لا يدعم تشغيل الكاميرا مباشرة. يمكنك رفع صورة الباركود أو العودة للدخول اليدوي.'
        );
        return;
      }

      try {
        await stopCamera();
        const containerEl = document.getElementById(viewportId);
        if (!containerEl) return;

        const html5QrCode = new Html5Qrcode(viewportId);
        scannerRef.current = html5QrCode;

        const scanConfig = {
          fps: 12,
          qrbox: (vw: number, vh: number) => {
            const minEdge = Math.min(vw, vh);
            if (minEdge <= 0) return { width: 180, height: 180 };
            const size = Math.max(120, Math.min(240, Math.floor(minEdge * 0.72)));
            const safeSize = Math.max(80, Math.min(size, minEdge - 16));
            return { width: safeSize, height: safeSize };
          },
          aspectRatio: 1.0,
        };

        const onDecoded = (decodedText: string) => {
          if (!verifyingLockRef.current && decodedText.trim()) {
            verifyScannedToken(decodedText);
          }
        };

        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (mountedRef.current) {
          setHasMultipleCameras(Array.isArray(cameras) && cameras.length > 1);
        }

        try {
          await html5QrCode.start({ facingMode: targetFacing }, scanConfig, onDecoded, () => {});
        } catch (primaryErr) {
          if (!cameras || cameras.length === 0) throw primaryErr;
          const preferred =
            targetFacing === 'environment'
              ? cameras.find((c) => /back|rear|environment|خلف/i.test(c.label)) ||
                cameras[cameras.length - 1]
              : cameras.find((c) => /front|user|أمام/i.test(c.label)) || cameras[0];
          await html5QrCode.start(preferred.id, scanConfig, onDecoded, () => {});
        }

        if (mountedRef.current) {
          setCameraActive(true);
        }
      } catch (err: any) {
        const msg = String(err?.name || err?.message || err || '');
        const isPermissionDenied = /NotAllowedError|Permission|denied/i.test(msg);
        const isNoCamera = /NotFoundError|DevicesNotFound/i.test(msg);
        setCameraError(
          isPermissionDenied
            ? 'لم يتم منح إذن الكاميرا. اسمح للمتصفح بالوصول إلى الكاميرا ثم اضغط «إعادة المحاولة»، أو استخدم الدخول اليدوي.'
            : isNoCamera
            ? 'لم يتم العثور على كاميرا متصلة بهذا الجهاز. يمكنك رفع صورة الباركود أو العودة للدخول اليدوي.'
            : 'تعذر تشغيل الكاميرا على هذا المتصفح. يمكنك إعادة المحاولة أو رفع صورة البطاقة أو الدخول يدوياً.'
        );
        setCameraActive(false);
      }
    },
    [facingMode, isOpen, stopCamera, verifyScannedToken]
  );

  // إعادة تهيئة الحالة عند فتح أو إغلاق النافذة (لا تفتح الكاميرا إلا عند فتح النافذة)
  useEffect(() => {
    mountedRef.current = true;
    if (isOpen) {
      verifyingLockRef.current = false;
      setScanPhase('scanning');
      setRecognizedStudent(null);
      setScanError(null);
      setCameraError(null);
      setStatusMessage(null);
      setDetectedBadge(false);
      setPendingQrToken('');
      setExtraPin('');

      const timer = window.setTimeout(() => {
        startCamera(facingMode);
      }, 220);

      return () => {
        window.clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [isOpen, facingMode]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanError(null);
    setCameraError(null);
    try {
      const html5QrCode = new Html5Qrcode('student-card-file-temp-viewport');
      const decodedText = await html5QrCode.scanFile(file, false);
      html5QrCode.clear();
      await verifyScannedToken(decodedText);
    } catch {
      setScanPhase('error');
      setScanError('لم يتم العثور على باركود QR صالح في الصورة المختارة.');
    }
  };

  const handleSubmitExtraPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingQrToken || !extraPin.trim()) {
      setScanError('يرجى إدخال رمز الدخول لإتمام التحقق الإضافي.');
      return;
    }
    setVerifyingPin(true);
    setScanError(null);
    try {
      await verifyScannedToken(pendingQrToken, extraPin);
    } finally {
      if (mountedRef.current) setVerifyingPin(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseClean}
      title="تسجيل الدخول عن طريق الباركود"
      subtitle="وجّه الكاميرا نحو باركود الطالب للدخول السريع والآمن"
      maxWidth="md"
    >
      <div className="space-y-4 text-right font-arabic" dir="rtl">
        {/* حاوية مخفية لقراءة الصور المرفوعة */}
        <div id="student-card-file-temp-viewport" className="hidden" />

        {/* حالة النجاح */}
        {scanPhase === 'success' && recognizedStudent && (
          <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 space-y-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-base text-emerald-950">
                تم تسجيل الدخول بنجاح!
              </h3>
              <p className="text-xs text-emerald-800 mt-1 font-bold">
                مرحباً بك، {recognizedStudent.fullName} ({recognizedStudent.internalId})
              </p>
              <p className="text-[11px] text-emerald-700 mt-1">
                جارٍ تحويلك إلى لوحة الطالب...
              </p>
            </div>
          </div>
        )}

        {/* حالة التحقق الإضافي برمز الدخول (2FA الاختياري من الإدارة) */}
        {scanPhase === 'pin_required' && (
          <form onSubmit={handleSubmitExtraPin} className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#e3ecf3]/75 border border-[#c5d8df] flex items-start gap-3">
              <div className="p-2 rounded-xl bg-[#3b707d] text-white shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-1">
                <span className="font-black text-[#1c353d] block">
                  تمت قراءة باركود الطالب بنجاح {studentCodeHint ? `(${studentCodeHint})` : ''}
                </span>
                <p className="text-slate-600 leading-relaxed">
                  لزيادة الأمان، فعّلت الإدارة التحقق الإضافي. أدخل <strong>رمز الدخول</strong> الخاص بك لإتمام الدخول.
                </p>
              </div>
            </div>

            {scanError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">رمز الدخول:</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#3b707d] absolute right-3.5 top-4 pointer-events-none" />
                <input
                  type={showExtraPin ? 'text' : 'password'}
                  dir="ltr"
                  autoFocus
                  value={extraPin}
                  onChange={(e) => setExtraPin(e.target.value)}
                  placeholder="••••••"
                  className="w-full min-h-[48px] pr-10 pl-12 py-3 text-sm font-mono font-black tracking-widest rounded-xl border border-slate-300 bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#3b707d] focus:border-[#3b707d] focus:outline-none text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowExtraPin((v) => !v)}
                  className="absolute left-1 top-1 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#3b707d]"
                  aria-label={showExtraPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                >
                  {showExtraPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={verifyingPin}
                icon={<CheckCircle2 className="w-4 h-4" />}
                className="flex-1"
              >
                تأكيد والدخول
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => startCamera(facingMode)}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                إعادة المسح
              </Button>
            </div>
          </form>
        )}

        {/* واجهة المسح الرئيسية */}
        {scanPhase !== 'success' && scanPhase !== 'pin_required' && (
          <div className="space-y-4">
            {/* إطار التصوير الذكي */}
            <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[310px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-[#3b707d] shadow-card flex items-center justify-center">
              <div id={viewportId} className="w-full h-full" />

              {/* زوايا الإطار الإرشادي */}
              <div className="absolute top-3.5 right-3.5 w-7 h-7 border-t-[3px] border-r-[3px] border-teal-400 rounded-tr-lg pointer-events-none" />
              <div className="absolute top-3.5 left-3.5 w-7 h-7 border-t-[3px] border-l-[3px] border-teal-400 rounded-tl-lg pointer-events-none" />
              <div className="absolute bottom-3.5 right-3.5 w-7 h-7 border-b-[3px] border-r-[3px] border-teal-400 rounded-br-lg pointer-events-none" />
              <div className="absolute bottom-3.5 left-3.5 w-7 h-7 border-b-[3px] border-l-[3px] border-teal-400 rounded-bl-lg pointer-events-none" />

              {/* خط المسح النشط */}
              {cameraActive && scanPhase === 'scanning' && (
                <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-teal-400 shadow-[0_0_14px_#2dd4bf] animate-pulse pointer-events-none" />
              )}

              {/* مؤشر اكتشاف الباركود وحالة التحقق */}
              {(detectedBadge || scanPhase === 'verifying') && (
                <div className="absolute inset-0 bg-[#1c353d]/90 backdrop-blur-sm flex flex-col items-center justify-center text-white p-5 text-center space-y-3 z-20">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-400/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-300" />
                  </div>
                  <div className="space-y-1">
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-200 text-[10px] font-black">
                      تم اكتشاف الباركود
                    </span>
                    <p className="text-xs font-black text-white">
                      {statusMessage || 'جارٍ التحقق من الحساب...'}
                    </p>
                  </div>
                </div>
              )}

              {/* انتظار تشغيل الكاميرا */}
              {!cameraActive && !cameraError && scanPhase === 'scanning' && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white p-5 text-center space-y-2.5 z-10">
                  <Camera className="w-7 h-7 text-teal-400 animate-pulse" />
                  <span className="text-xs font-bold">جارٍ تشغيل الكاميرا وطلب الإذن...</span>
                  <span className="text-[11px] text-slate-300">
                    وافق على إذن الكاميرا عند ظهوره في المتصفح
                  </span>
                </div>
              )}

              {/* رسالة رفض إذن الكاميرا أو تعذر التشغيل */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-5 text-center space-y-3 z-20">
                  <AlertCircle className="w-8 h-8 text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-100 font-bold leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#3b707d] hover:bg-[#2f5b66] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إعادة المحاولة</span>
                    </button>
                    {onSwitchToCode && (
                      <button
                        type="button"
                        onClick={handleSwitchToCode}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>الدخول بالرمز</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* زر تبديل الكاميرا (أمامية / خلفية) */}
              {cameraActive && scanPhase === 'scanning' && hasMultipleCameras && (
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                  }
                  className="absolute bottom-3 left-3 z-20 min-h-[38px] px-3 py-1.5 rounded-xl bg-black/65 hover:bg-black/85 text-white text-[11px] font-bold backdrop-blur-sm flex items-center gap-1.5 border border-white/20 transition-all"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                  <span>{facingMode === 'environment' ? 'الأمامية' : 'الخلفية'}</span>
                </button>
              )}
            </div>

            {/* التعليمات القصيرة الواضحة */}
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-[#1c353d]">
                <QrCode className="w-4 h-4 text-[#3b707d]" />
                <span>وجّه الكاميرا نحو باركود الطالب</span>
              </div>
              <p className="text-[11px] text-slate-500">
                سيتم قراءة الرمز والتحقق من حسابك تلقائياً دون الحاجة لكتابة كلمة المرور
              </p>
            </div>

            {/* رسالة خطأ المسح */}
            {scanPhase === 'error' && scanError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2.5"
              >
                <div className="flex items-start gap-2 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => startCamera(facingMode)}
                  >
                    إعادة المحاولة بالكاميرا
                  </Button>
                  {onSwitchToCode && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<KeyRound className="w-3.5 h-3.5" />}
                      onClick={handleSwitchToCode}
                    >
                      الدخول بالرمز
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* خيار بديل: رفع صورة الباركود أو الدخول بالرمز أو إغلاق النافذة */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <label className="min-h-[42px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-[#e3ecf3]/75 hover:bg-[#e3ecf3] text-[#284d57] text-xs font-bold cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-[#3b707d]" />
                <span>رفع صورة الباركود من الجهاز</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <div className="flex items-center gap-2">
                {onSwitchToCode && (
                  <button
                    type="button"
                    onClick={handleSwitchToCode}
                    className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#3b707d]/30 bg-white hover:bg-[#e3ecf3]/40 text-[#1c353d] text-xs font-bold transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#3b707d]" />
                    <span>الدخول بالرمز</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseClean}
                  className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>إغلاق</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
