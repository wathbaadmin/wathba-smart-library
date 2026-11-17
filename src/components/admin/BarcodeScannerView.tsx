import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Student, BookCopy, Book, Loan, ConditionRating } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatArabicDate, isOverdue, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { AdminTab } from './AdminSidebar';
import {
  Scan,
  BookOpen,
  RotateCcw,
  User,
  CheckCircle2,
  AlertCircle,
  Camera,
  Keyboard,
  ArrowRight,
  Sparkles,
  Layers,
  Calendar,
  Clock,
  ShieldCheck,
  RefreshCw,
  X,
  FileCheck,
  PackageCheck,
  AlertTriangle,
  MapPin,
  ChevronLeft,
} from 'lucide-react';

interface BarcodeScannerViewProps {
  onNavigateTab?: (tab: AdminTab) => void;
}

type TerminalMode = 'idle' | 'borrow' | 'return';
type BorrowStep = 'scan_student' | 'scan_book' | 'confirm' | 'success';
type ReturnStep = 'scan_student' | 'select_book' | 'inspect' | 'success';

export const BarcodeScannerView: React.FC<BarcodeScannerViewProps> = ({ onNavigateTab }) => {
  const {
    students,
    books,
    copies,
    loans,
    settings,
    checkoutBook,
    returnBook,
    isStudentEligibleForLoan,
  } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  // الحالة العامة للمحطة (تبدأ بـ idle دون تشغيل الكاميرا)
  const [terminalMode, setTerminalMode] = useState<TerminalMode>('idle');
  const [borrowStep, setBorrowStep] = useState<BorrowStep>('scan_student');
  const [returnStep, setReturnStep] = useState<ReturnStep>('scan_student');

  // الكاميرا والإدخال اليدوي
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'wathba-barcode-terminal-viewport';

  // بيانات عملية الاستعارة
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedCopy, setSelectedCopy] = useState<BookCopy | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [borrowNotes, setBorrowNotes] = useState('');
  const [borrowCondition, setBorrowCondition] = useState<ConditionRating>('good');
  const [completedLoanId, setCompletedLoanId] = useState<string | null>(null);

  // بيانات عملية الإرجاع
  const [returnStudent, setReturnStudent] = useState<Student | null>(null);
  const [returnSelectedLoan, setReturnSelectedLoan] = useState<Loan | null>(null);
  const [returnSelectedCopy, setReturnSelectedCopy] = useState<BookCopy | null>(null);
  const [returnSelectedBook, setReturnSelectedBook] = useState<Book | null>(null);
  const [returnCondition, setReturnCondition] = useState<ConditionRating>('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnPhotos, setReturnPhotos] = useState<string[]>([]);

  const supervisorId = currentStaff?.id || 'staff-admin-1';
  const supervisorName = currentStaff?.fullName || 'المشرف المسؤول';

  // نغمات التنبيه الصوتي
  const playAudioFeedback = (type: 'beep' | 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'beep') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'error') {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) {
      // تجاهل إذا كانت بيئة الصوت مقيدة بالمتصفح
    }
  };

  // -------------------------------------------------------------
  // إدارة الكاميرا
  // -------------------------------------------------------------
  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // تجاهل أخطاء إيقاف الكاميرا
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setInlineError(null);

    // تأكد من وجود العنصر في DOM قبل البدء
    const container = document.getElementById(scannerId);
    if (!container) return;

    try {
      if (scannerRef.current) {
        await stopCamera();
      }

      const html5QrCode = new Html5Qrcode(scannerId);
      scannerRef.current = html5QrCode;

      const scanConfig = {
        fps: 10,
        qrbox: (vw: number, vh: number) => {
          const minEdge = Math.min(vw, vh);
          if (minEdge <= 0) return { width: 180, height: 180 };
          const size = Math.max(100, Math.min(250, Math.floor(minEdge * 0.72)));
          const safeSize = Math.max(50, Math.min(size, minEdge - 16));
          return { width: safeSize, height: safeSize };
        },
        aspectRatio: 1.0,
      };

      try {
        await html5QrCode.start(
          { facingMode },
          scanConfig,
          (decodedText) => {
            handleIncomingCode(decodedText.trim());
          },
          () => {}
        );
      } catch (primaryErr) {
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (!cameras || cameras.length === 0) throw primaryErr;
        const preferred =
          facingMode === 'environment'
            ? cameras.find((c) => /back|rear|environment|خلف/i.test(c.label)) || cameras[cameras.length - 1]
            : cameras.find((c) => /front|user|أمام/i.test(c.label)) || cameras[0];
        await html5QrCode.start(
          preferred.id,
          scanConfig,
          (decodedText) => {
            handleIncomingCode(decodedText.trim());
          },
          () => {}
        );
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera failed:', err);
      setCameraError('تعذر فتح الكاميرا (يرجى السماح بالإذن أو استخدام الإدخال اليدوي أدناه)');
      setCameraActive(false);
    }
  };

  const toggleFacingMode = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    if (cameraActive) {
      await stopCamera();
      setTimeout(() => {
        startCamera();
      }, 200);
    }
  };

  // إيقاف الكاميرا عند الخروج من الصفحة
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // تشغيل الكاميرا فقط عند الانتقال إلى خطوة مسح
  useEffect(() => {
    const shouldRunCamera =
      (terminalMode === 'borrow' && (borrowStep === 'scan_student' || borrowStep === 'scan_book')) ||
      (terminalMode === 'return' && returnStep === 'scan_student');

    if (shouldRunCamera) {
      const timer = setTimeout(() => {
        startCamera();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [terminalMode, borrowStep, returnStep, facingMode]);

  // -------------------------------------------------------------
  // إعادة التعيين والعودة للشاشة الرئيسية
  // -------------------------------------------------------------
  const handleResetToIdle = () => {
    stopCamera();
    setTerminalMode('idle');
    setBorrowStep('scan_student');
    setReturnStep('scan_student');
    setSelectedStudent(null);
    setSelectedCopy(null);
    setSelectedBook(null);
    setBorrowNotes('');
    setBorrowCondition('good');
    setReturnStudent(null);
    setReturnSelectedLoan(null);
    setReturnSelectedCopy(null);
    setReturnSelectedBook(null);
    setReturnCondition('good');
    setReturnNotes('');
    setReturnPhotos([]);
    setManualCode('');
    setInlineError(null);
    setCameraError(null);
  };

  // -------------------------------------------------------------
  // مطابقة الرموز المستلمة (من الكاميرا أو الإدخال اليدوي)
  // -------------------------------------------------------------
  const findStudentByCode = (code: string): Student | undefined => {
    const clean = code.trim().toLowerCase();
    return students.find(
      (s) =>
        s.qrToken.toLowerCase() === clean ||
        s.internalId.toLowerCase() === clean ||
        s.accessCodeHash === clean ||
        s.rawAccessCode === clean ||
        s.fullName.trim().toLowerCase() === clean
    );
  };

  const findCopyByCode = (code: string): BookCopy | undefined => {
    const clean = code.trim().toLowerCase();
    return copies.find(
      (c) =>
        c.copyCode.toLowerCase() === clean ||
        c.qrData.toLowerCase() === clean ||
        c.id.toLowerCase() === clean
    );
  };

  const handleIncomingCode = (code: string) => {
    if (!code) return;
    setInlineError(null);

    // ================== مسار الاستعارة ==================
    if (terminalMode === 'borrow') {
      if (borrowStep === 'scan_student') {
        const student = findStudentByCode(code);
        if (!student) {
          playAudioFeedback('error');
          setInlineError(`لم يتم العثور على طالب يطابق الرمز: "${code}"`);
          return;
        }

        if (student.status !== 'active') {
          playAudioFeedback('error');
          setInlineError(`عذراً، حساب الطالب ${student.fullName} معلق أو موقوف.`);
          return;
        }

        const eligibility = isStudentEligibleForLoan(student.id);
        if (!eligibility.eligible) {
          playAudioFeedback('error');
          setInlineError(eligibility.reason || 'الطالب غير مؤهل للاستعارة حالياً (تجاوز الحد الأقصى).');
          return;
        }

        // نجاح مسح الطالب
        playAudioFeedback('beep');
        setSelectedStudent(student);
        setManualCode('');
        showToast(`تم مسح وتأكيد بيانات الطالب: ${student.fullName} 🌟`, 'success');
        setBorrowStep('scan_book');
      } else if (borrowStep === 'scan_book') {
        const copy = findCopyByCode(code);
        if (!copy) {
          playAudioFeedback('error');
          setInlineError(`لم يتم العثور على نسخة كتاب تطابق الرمز: "${code}"`);
          return;
        }

        // التحقق من حالة النسخة
        if (copy.status === 'borrowed') {
          playAudioFeedback('error');
          setInlineError(`هذه النسخة (${copy.copyCode}) مستعارة بالفعل لطالب آخر ولا يمكن إعارتها.`);
          return;
        }

        if (copy.status === 'damaged' || copy.status === 'lost') {
          playAudioFeedback('error');
          setInlineError(`النسخة غير متاحة للإعارة حالياً (حالتها: ${copy.status === 'damaged' ? 'متضررة' : 'مفقودة'}).`);
          return;
        }

        if (copy.status === 'under_inspection') {
          playAudioFeedback('error');
          setInlineError(`النسخة موجودة على رف الإرجاع وتنتظر اعتماد الفحص أولاً قبل إتاحتها.`);
          return;
        }

        const book = books.find((b) => b.id === copy.bookId);
        playAudioFeedback('beep');
        setSelectedCopy(copy);
        setSelectedBook(book || null);
        setBorrowCondition(copy.condition || 'good');
        setManualCode('');
        stopCamera();
        setBorrowStep('confirm');
      }
    }

    // ================== مسار الإرجاع ==================
    if (terminalMode === 'return') {
      if (returnStep === 'scan_student') {
        const student = findStudentByCode(code);
        if (!student) {
          playAudioFeedback('error');
          setInlineError(`لم يتم العثور على طالب يطابق الرمز: "${code}"`);
          return;
        }

        const activeStudentLoans = loans.filter(
          (l) => l.studentId === student.id && l.status === 'active'
        );

        if (activeStudentLoans.length === 0) {
          playAudioFeedback('error');
          setInlineError(`الطالب ${student.fullName} ليس لديه أي كتب مستعارة حالياً لإرجاعها.`);
          return;
        }

        playAudioFeedback('beep');
        setReturnStudent(student);
        setManualCode('');
        stopCamera();
        setReturnStep('select_book');
      }
    }
  };

  // تأكيد إدخال الكود اليدوي
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleIncomingCode(manualCode.trim());
  };

  // -------------------------------------------------------------
  // تنفيذ الاستعارة النهائي
  // -------------------------------------------------------------
  const handleConfirmBorrow = () => {
    if (!selectedStudent || !selectedCopy) return;

    const res = checkoutBook({
      copyId: selectedCopy.id,
      studentId: selectedStudent.id,
      supervisorId,
      conditionNotes: borrowNotes.trim() || undefined,
      conditionRating: borrowCondition,
    });

    if (res.success && res.loan) {
      playAudioFeedback('success');
      setCompletedLoanId(res.loan.id);
      setBorrowStep('success');
      showToast(
        `تمت عملية استعارة "${selectedBook?.title}" للطالب ${selectedStudent.fullName} بنجاح!`,
        'success'
      );
    } else {
      playAudioFeedback('error');
      setInlineError(res.error || 'حدث خطأ أثناء تسجيل الاستعارة');
    }
  };

  // -------------------------------------------------------------
  // تنفيذ الإرجاع النهائي
  // -------------------------------------------------------------
  const handleSelectLoanForReturn = (loan: Loan) => {
    const copy = copies.find((c) => c.id === loan.copyId);
    const book = books.find((b) => b.id === copy?.bookId);
    setReturnSelectedLoan(loan);
    setReturnSelectedCopy(copy || null);
    setReturnSelectedBook(book || null);
    setReturnCondition(copy?.condition || 'good');
    setReturnStep('inspect');
  };

  const handleScanCopyDirectlyForReturn = (copyCode: string) => {
    if (!returnStudent) return;
    const copy = findCopyByCode(copyCode);
    if (!copy) {
      playAudioFeedback('error');
      setInlineError(`لم يتم العثور على نسخة تطابق الرمز: "${copyCode}"`);
      return;
    }

    const matchedLoan = loans.find(
      (l) => l.studentId === returnStudent.id && l.copyId === copy.id && l.status === 'active'
    );

    if (!matchedLoan) {
      playAudioFeedback('error');
      setInlineError(
        `النسخة (${copy.copyCode}) غير مسجلة كإعارة نشطة للطالب ${returnStudent.fullName}!`
      );
      return;
    }

    handleSelectLoanForReturn(matchedLoan);
  };

  const handleConfirmReturn = () => {
    if (!returnSelectedLoan || !returnSelectedCopy) return;

    const res = returnBook({
      loanId: returnSelectedLoan.id,
      supervisorId,
      conditionRating: returnCondition,
      details: returnNotes.trim() || `استرجاع عبر مسح الباركود - تقييم الفحص: ${returnCondition}`,
      photos: returnPhotos,
      sendToReturnShelf: true, // تذهب لرف الفحص أولاً لحماية الكتب
    });

    if (res.success) {
      playAudioFeedback('success');
      setReturnStep('success');
      showToast(
        `تم استرجاع نسخة "${returnSelectedBook?.title}" بنجاح ونقلها لرف الإرجاع (قيد الفحص)!`,
        'success'
      );
    } else {
      playAudioFeedback('error');
      setInlineError(res.error || 'حدث خطأ أثناء تسجيل الاسترجاع');
    }
  };

  // قائمة إعارات الطالب النشطة المتاحة للإرجاع
  const returnStudentActiveLoans = returnStudent
    ? loans.filter((l) => l.studentId === returnStudent.id && l.status === 'active')
    : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-arabic text-slate-800">
      {/* ========================================================= */}
      {/* 1. الشاشة الرئيسية: اختيار العملية (لا تفتح الكاميرا إطلاقاً) */}
      {/* ========================================================= */}
      {terminalMode === 'idle' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-l from-wathba-900 via-wathba-800 to-emerald-900 text-white shadow-soft flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 text-emerald-200 text-xs font-bold border border-emerald-500/30">
                <Scan className="w-4 h-4 text-gold-400" />
                <span>محطة مسح الباركود الميدانية • فريق وثبة</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                محطة مسح الباركود وإدارة العمليات
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
                اختر نوع العملية المطلوبة للبدء. لن يتم تشغيل الكاميرا إلا بعد تحديد طلبك لضمان السرعة والدقة ومنع أي أخطاء.
              </p>
            </div>

            <div className="text-center md:text-left shrink-0 bg-white/10 px-4 py-3 rounded-2xl border border-white/15">
              <span className="text-[10px] text-emerald-300 block font-bold">المشرف المسؤول:</span>
              <span className="text-xs font-bold text-white block mt-0.5">{supervisorName}</span>
              <span className="text-[10px] text-emerald-200 font-mono block mt-1">
                توقيت الرياض • {new Date().toLocaleDateString('ar-SA')}
              </span>
            </div>
          </div>

          {/* Two Large Operation Choice Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-2">
            {/* بطاقة 1: استعارة كتاب */}
            <div
              onClick={() => {
                setTerminalMode('borrow');
                setBorrowStep('scan_student');
              }}
              className="group relative rounded-3xl bg-white border-2 border-[#e3ecf3] p-5 sm:p-8 shadow-card hover:shadow-premium hover:border-[#3b707d] transition-all duration-300 cursor-pointer flex flex-col justify-between text-right overflow-hidden"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#e3ecf3]/70 text-[#3b707d] border border-[#e3ecf3] flex items-center justify-center group-hover:scale-105 group-hover:bg-[#3b707d] group-hover:text-white transition-all duration-300 shadow-soft">
                  <BookOpen className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e3ecf3] text-[#284d57] text-[11px] font-bold mb-2">
                    العملية الأولى
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-[#3b707d] transition-colors">
                    استعارة كتاب
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-2 font-medium">
                    تسجيل عملية استعارة كتاب لطالب بمسح بطاقة الطالب ثم مسح باركود نسخة الكتاب للتحقق التلقائي والربط الفوري.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-[#3b707d] group-hover:text-[#284d57] flex items-center gap-1">
                  بدء عملية الاستعارة الآن
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </span>
                <span className="w-9 h-9 rounded-full bg-[#e3ecf3] group-hover:bg-[#3b707d] group-hover:text-white text-[#3b707d] flex items-center justify-center transition-colors">
                  <Scan className="w-4 h-4" />
                </span>
              </div>
            </div>

            {/* بطاقة 2: إرجاع كتاب */}
            <div
              onClick={() => {
                setTerminalMode('return');
                setReturnStep('scan_student');
              }}
              className="group relative rounded-3xl bg-white border-2 border-[#e3ecf3] p-5 sm:p-8 shadow-card hover:shadow-premium hover:border-[#3b707d] transition-all duration-300 cursor-pointer flex flex-col justify-between text-right overflow-hidden"
            >
              <div className="space-y-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#f6f8fa] text-[#284d57] border border-[#e3ecf3] flex items-center justify-center group-hover:scale-105 group-hover:bg-[#284d57] group-hover:text-white transition-all duration-300 shadow-soft">
                  <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f6f8fa] border border-[#e3ecf3] text-[#284d57] text-[11px] font-bold mb-2">
                    العملية الثانية
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-[#3b707d] transition-colors">
                    إرجاع كتاب
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mt-2 font-medium">
                    تسجيل عملية إعادة كتاب مستعار من الطالب، التحقق من الإعارة، توثيق فحص حالة الكتاب، ونقله لرف الإرجاع.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-[#284d57] group-hover:text-[#3b707d] flex items-center gap-1">
                  بدء عملية الإرجاع الآن
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </span>
                <span className="w-9 h-9 rounded-full bg-[#e3ecf3] group-hover:bg-[#284d57] group-hover:text-white text-[#284d57] flex items-center justify-center transition-colors">
                  <Scan className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="p-4 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] text-slate-600 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3b707d] shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>ضوابط النظام:</strong> الحد الأقصى للإعارة كتابان لكل طالب • تذهب النسخ المعادة إلى رف الفحص لحين اعتماد المشرف لسلامتها.
              </span>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('loans')}
                className="text-[#3b707d] font-bold hover:underline shrink-0 text-right sm:text-left min-h-[36px]"
              >
                عرض سجل الإعارات
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. مسار استعارة كتاب (BORROW WORKFLOW) */}
      {/* ========================================================= */}
      {terminalMode === 'borrow' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Breadcrumb Navigation & Cancel Button */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#e3ecf3] shadow-soft flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-slate-400">مسح الباركود</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#3b707d] flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                استعارة كتاب
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<X className="w-4 h-4" />}
              onClick={handleResetToIdle}
              className="text-xs w-full sm:w-auto"
            >
              إلغاء والعودة لاختيار العملية
            </Button>
          </div>

          {/* Step Progress Bar */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-center">
            <div
              className={`p-2 sm:p-3 rounded-2xl border transition-all ${
                borrowStep === 'scan_student'
                  ? 'bg-[#3b707d] text-white border-[#3b707d] shadow-soft'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>1. مسح الطالب</span>
            </div>
            <div
              className={`p-2 sm:p-3 rounded-2xl border transition-all ${
                borrowStep === 'scan_book'
                  ? 'bg-[#3b707d] text-white border-[#3b707d] shadow-soft'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>2. مسح الكتاب</span>
            </div>
            <div
              className={`p-2 sm:p-3 rounded-2xl border transition-all ${
                borrowStep === 'confirm' || borrowStep === 'success'
                  ? 'bg-[#3b707d] text-white border-[#3b707d] shadow-soft'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>3. مراجعة وتأكيد</span>
            </div>
          </div>

          {/* Error Banner */}
          {inlineError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3 animate-in shake">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-bold">{inlineError}</span>
              </div>
              <button
                onClick={() => setInlineError(null)}
                className="p-1 text-rose-500 hover:text-rose-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: SCAN STUDENT */}
          {borrowStep === 'scan_student' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-soft space-y-6 text-center">
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  الخطوة 1: مسح بطاقة QR الخاصة بالطالب
                </h3>
                <p className="text-xs text-slate-500">
                  وجّه الكاميرا نحو بطاقة عضوية الطالب للتحقق من حسابه وعدد الإعارات المسموحة.
                </p>
              </div>

              {/* Camera Scanner Viewport */}
              <div className="w-full max-w-[270px] sm:max-w-md mx-auto relative rounded-3xl overflow-hidden border-2 border-[#3b707d] shadow-card bg-slate-950 aspect-square flex items-center justify-center">
                <div id={scannerId} className="w-full h-full"></div>

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3 bg-slate-950/80 p-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-xs font-bold">جارٍ تشغيل الكاميرا...</span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3 bg-slate-950/90 p-6 text-center">
                    <Camera className="w-10 h-10 text-rose-400" />
                    <span className="text-xs text-rose-200 font-bold">{cameraError}</span>
                  </div>
                )}

                {/* Camera Flip button */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="absolute bottom-3 left-3 z-20 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 border border-white/20 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تبديل الكاميرا</span>
                </button>
              </div>

              {/* Manual Input Fallback */}
              <div className="max-w-md mx-auto pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 justify-center text-xs font-bold text-slate-600">
                  <Keyboard className="w-4 h-4 text-slate-400" />
                  <span>أو أدخل رقم الطالب أو اسمه يدوياً:</span>
                </div>
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="مثال: STU-1001 أو 1001 أو اسم الطالب"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-right"
                  />
                  <Button variant="primary" size="md" type="submit" className="text-xs font-bold px-5">
                    تحقق
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* STEP 2: SCAN BOOK COPY */}
          {borrowStep === 'scan_book' && selectedStudent && (
            <div className="space-y-6">
              {/* Selected Student Info Strip */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold block">
                      الطالب المستعير (تم التحقق ✓)
                    </span>
                    <h4 className="text-sm font-black text-slate-900">{selectedStudent.fullName}</h4>
                    <span className="text-[11px] text-slate-500">
                      {selectedStudent.grade} • {selectedStudent.groupName} • {selectedStudent.internalId}
                    </span>
                  </div>
                </div>

                <div className="text-left flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-xl border border-emerald-200">
                    الإعارات الحالية: {selectedStudent.currentActiveLoans} من {settings.maxLoansPerStudent}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedStudent(null);
                      setBorrowStep('scan_student');
                    }}
                    className="text-xs text-rose-600 hover:underline font-bold"
                  >
                    تغيير الطالب
                  </button>
                </div>
              </div>

              {/* Camera Scanner Viewport for Book */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-soft space-y-6 text-center">
                <div className="max-w-md mx-auto space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-royal-50 text-royal-700 flex items-center justify-center mx-auto border border-royal-200">
                    <Scan className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    الخطوة 2: مسح باركود نسخة الكتاب الورقية
                  </h3>
                  <p className="text-xs text-slate-500">
                    وجّه الكاميرا نحو ملصق الـ QR الموجود على غلاف النسخة الورقية للتحقق من توفرها.
                  </p>
                </div>

                <div className="max-w-md mx-auto relative rounded-3xl overflow-hidden border-2 border-royal-500 shadow-card bg-slate-950 aspect-square flex items-center justify-center">
                  <div id={scannerId} className="w-full h-full"></div>

                  {!cameraActive && !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3 bg-slate-950/80 p-4">
                      <RefreshCw className="w-8 h-8 animate-spin text-royal-400" />
                      <span className="text-xs font-bold">جارٍ تشغيل الكاميرا لمسح الكتاب...</span>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3 bg-slate-950/90 p-6 text-center">
                      <Camera className="w-10 h-10 text-rose-400" />
                      <span className="text-xs text-rose-200 font-bold">{cameraError}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="absolute bottom-3 left-3 z-20 min-h-[40px] px-3.5 py-2 rounded-xl bg-black/65 hover:bg-black/85 text-white text-xs font-bold backdrop-blur-sm flex items-center gap-1.5 border border-white/20 transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تبديل الكاميرا</span>
                  </button>
                </div>

                {/* Manual Code Input */}
                <div className="max-w-md mx-auto pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center gap-2 justify-center text-xs font-bold text-slate-600">
                    <Keyboard className="w-4 h-4 text-[#3b707d]" />
                    <span>أو اكتب رمز النسخة يدوياً:</span>
                  </div>
                  <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="مثال: WTH-125-001 أو WTH-000125-001"
                      className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold font-mono focus:ring-2 focus:ring-[#3b707d] focus:outline-none text-center"
                    />
                    <Button variant="primary" size="md" type="submit" className="text-xs font-bold px-5 w-full sm:w-auto">
                      تحقق
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRM */}
          {borrowStep === 'confirm' && selectedStudent && selectedCopy && selectedBook && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-soft space-y-6">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  <FileCheck className="w-4 h-4" />
                  <span>الخطوة 3: مراجعة تفاصيل عملية الاستعارة قبل الاعتماد</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  تأكيد تسليم الكتاب للطالب
                </h3>
              </div>

              {/* Review Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student Card */}
                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800">بيانات الطالب المستعير</span>
                    <Badge status={selectedStudent.status} size="sm" />
                  </div>
                  <h4 className="text-base font-black text-slate-900">{selectedStudent.fullName}</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>الصف: <strong>{selectedStudent.grade}</strong> ({selectedStudent.stage})</div>
                    <div>المجموعة: <strong>{selectedStudent.groupName}</strong></div>
                    <div>الرقم الأكاديمي: <strong className="font-mono">{selectedStudent.internalId}</strong></div>
                    <div className="text-emerald-700 font-bold pt-1">
                      الإعارات الحالية: {selectedStudent.currentActiveLoans} كتاب
                    </div>
                  </div>
                </div>

                {/* Book Copy Card */}
                <div className="p-5 rounded-2xl bg-royal-50/70 border border-royal-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-royal-800">بيانات النسخة الورقية</span>
                    <Badge status={selectedCopy.status} size="sm" />
                  </div>
                  <h4 className="text-base font-black text-slate-900">{selectedBook.title}</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>رمز النسخة: <strong className="font-mono text-royal-800">{selectedCopy.copyCode}</strong></div>
                    <div>رمز الكتاب العام: <strong className="font-mono">{selectedBook.code}</strong></div>
                    <div>موقع الرف: <strong>{selectedCopy.shelfLocation}</strong></div>
                    <div>حالة الفحص الحالية: <strong>{selectedCopy.condition}</strong></div>
                  </div>
                </div>
              </div>

              {/* Loan Terms Summary */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
                <div className="p-2">
                  <span className="text-slate-400 block text-[10px]">تاريخ الإعارة</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {new Date().toLocaleDateString('ar-SA')}
                  </span>
                </div>
                <div className="p-2">
                  <span className="text-slate-400 block text-[10px]">مدة الإعارة</span>
                  <span className="font-bold text-slate-800">{settings.loanDurationDays} أيام</span>
                </div>
                <div className="p-2">
                  <span className="text-slate-400 block text-[10px]">موعد الإعادة الأقصى (أم القرى)</span>
                  <span className="font-bold text-emerald-800 block text-xs">
                    {formatUmmAlQuraDate(new Date(Date.now() + settings.loanDurationDays * 86400000).toISOString())}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({formatArabicDate(new Date(Date.now() + settings.loanDurationDays * 86400000).toISOString())})
                  </span>
                </div>
                <div className="p-2">
                  <span className="text-slate-400 block text-[10px]">المشرف المنفذ</span>
                  <span className="font-bold text-slate-800 truncate block">{supervisorName}</span>
                </div>
              </div>

              {/* Condition & Notes input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تقييم حالة النسخة عند التسليم:
                  </label>
                  <select
                    value={borrowCondition}
                    onChange={(e) => setBorrowCondition(e.target.value as ConditionRating)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="pristine">ممتاز وجديد (Pristine)</option>
                    <option value="good">سليم وجيد (Good)</option>
                    <option value="needs_monitoring">يحتاج متابعة (Needs Monitoring)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ملاحظات المشرف (اختياري):
                  </label>
                  <input
                    type="text"
                    value={borrowNotes}
                    onChange={(e) => setBorrowNotes(e.target.value)}
                    placeholder="أي ملاحظة عن حالة الكتاب أو موعد خاص..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Confirm Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setSelectedCopy(null);
                    setBorrowStep('scan_book');
                  }}
                  className="text-xs"
                >
                  مسح نسخة أخرى
                </Button>

                <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={handleResetToIdle} className="text-xs">
                    إلغاء العملية
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    onClick={handleConfirmBorrow}
                    className="text-xs font-black px-6 shadow-soft"
                  >
                    تأكيد تسجيل الاستعارة الآن 🚀
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS SCREEN */}
          {borrowStep === 'success' && selectedStudent && selectedCopy && selectedBook && (
            <div className="bg-white rounded-3xl border-2 border-emerald-300 p-8 shadow-card text-center space-y-6 animate-in zoom-in-95">
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-soft">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-gold-500" />
                  <span>تم التسجيل والربط بنجاح في قاعدة البيانات</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  تمت عملية استعارة الكتاب بنجاح!
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  تم تسليم نسخة «{selectedBook.title}» إلى الطالب «{selectedStudent.fullName}»، وتحديث حالة النسخة إلى «مستعارة».
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-right space-y-2">
                <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-slate-500">رمز النسخة:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedCopy.copyCode}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-slate-500">الطالب المستعير:</span>
                  <span className="font-bold text-slate-800">{selectedStudent.fullName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-slate-500">تاريخ الإرجاع المحدد:</span>
                  <span className="font-bold text-emerald-700">
                    {formatArabicDate(new Date(Date.now() + settings.loanDurationDays * 86400000).toISOString())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المشرف المسؤول:</span>
                  <span className="font-bold text-slate-800">{supervisorName}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <Button
                  variant="primary"
                  size="md"
                  icon={<Scan className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedStudent(null);
                    setSelectedCopy(null);
                    setSelectedBook(null);
                    setBorrowStep('scan_student');
                  }}
                  className="font-bold"
                >
                  استعارة جديدة لطالب آخر
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleResetToIdle}
                  className="font-bold"
                >
                  العودة لاختيار العملية
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. مسار إرجاع كتاب (RETURN WORKFLOW) */}
      {/* ========================================================= */}
      {terminalMode === 'return' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Breadcrumb Navigation & Cancel Button */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="text-slate-400">مسح الباركود</span>
              <span className="text-slate-300">/</span>
              <span className="text-royal-700 flex items-center gap-1">
                <RotateCcw className="w-4 h-4" />
                إرجاع كتاب
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={<X className="w-4 h-4" />}
              onClick={handleResetToIdle}
              className="text-xs"
            >
              إلغاء والعودة لاختيار العملية
            </Button>
          </div>

          {/* Step Progress Bar */}
          <div className="grid grid-cols-3 gap-2 text-xs font-bold text-center">
            <div
              className={`p-3 rounded-2xl border transition-all ${
                returnStep === 'scan_student'
                  ? 'bg-royal-600 text-white border-royal-600 shadow-soft'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>1. مسح بطاقة الطالب</span>
            </div>
            <div
              className={`p-3 rounded-2xl border transition-all ${
                returnStep === 'select_book'
                  ? 'bg-royal-600 text-white border-royal-600 shadow-soft'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>2. تحديد الكتاب المراد إرجاعه</span>
            </div>
            <div
              className={`p-3 rounded-2xl border transition-all ${
                returnStep === 'inspect' || returnStep === 'success'
                  ? 'bg-royal-600 text-white border-royal-600 shadow-soft'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <span>3. الفحص وتأكيد الإرجاع</span>
            </div>
          </div>

          {/* Error Banner */}
          {inlineError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3 animate-in shake">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-bold">{inlineError}</span>
              </div>
              <button
                onClick={() => setInlineError(null)}
                className="p-1 text-rose-500 hover:text-rose-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 1: SCAN STUDENT FOR RETURN */}
          {returnStep === 'scan_student' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-soft space-y-6 text-center">
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-royal-50 text-royal-700 flex items-center justify-center mx-auto border border-royal-200">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  الخطوة 1: مسح بطاقة QR للطالب المسترجع
                </h3>
                <p className="text-xs text-slate-500">
                  وجّه الكاميرا نحو بطاقة الطالب لعرض الكتب المسجلة كإعارات حالية في حسابه.
                </p>
              </div>

              {/* Camera Scanner Viewport */}
              <div className="max-w-md mx-auto relative rounded-3xl overflow-hidden border-2 border-royal-500 shadow-card bg-slate-950 aspect-square flex items-center justify-center">
                <div id={scannerId} className="w-full h-full"></div>

                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3 bg-slate-950/80 p-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-royal-400" />
                    <span className="text-xs font-bold">جارٍ تشغيل الكاميرا لمسح بطاقة الطالب...</span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3 bg-slate-950/90 p-6 text-center">
                    <Camera className="w-10 h-10 text-rose-400" />
                    <span className="text-xs text-rose-200 font-bold">{cameraError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="absolute bottom-3 left-3 z-20 min-h-[40px] px-3.5 py-2 rounded-xl bg-black/65 hover:bg-black/85 text-white text-xs font-bold backdrop-blur-sm flex items-center gap-1.5 border border-white/20 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تبديل الكاميرا</span>
                </button>
              </div>

              {/* Manual Input Fallback */}
              <div className="max-w-md mx-auto pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 justify-center text-xs font-bold text-slate-600">
                  <Keyboard className="w-4 h-4 text-[#3b707d]" />
                  <span>أو أدخل رقم الطالب أو اسمه يدوياً:</span>
                </div>
                <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="مثال: STU-1001 أو اسم الطالب"
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-[#3b707d] focus:outline-none text-right"
                  />
                  <Button variant="primary" size="md" type="submit" className="text-xs font-bold px-5 w-full sm:w-auto">
                    تحقق
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT BOOK FROM ACTIVE LOANS OR SCAN DIRECTLY */}
          {returnStep === 'select_book' && returnStudent && (
            <div className="space-y-6">
              {/* Student Info Header */}
              <div className="p-5 rounded-2xl bg-royal-50 border border-royal-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-royal-600 text-white flex items-center justify-center font-bold">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-royal-700 font-bold block">
                      الطالب المسترجع
                    </span>
                    <h3 className="text-base font-black text-slate-900">{returnStudent.fullName}</h3>
                    <span className="text-xs text-slate-500">
                      {returnStudent.grade} • {returnStudent.groupName} ({returnStudent.internalId})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-royal-800 bg-white px-3 py-1.5 rounded-xl border border-royal-200">
                    لديه {returnStudentActiveLoans.length} كتاب مستعار حالياً
                  </span>
                  <button
                    onClick={() => {
                      setReturnStudent(null);
                      setReturnStep('scan_student');
                    }}
                    className="text-xs text-rose-600 hover:underline font-bold"
                  >
                    تغيير الطالب
                  </button>
                </div>
              </div>

              {/* Direct Scan Box (Quick Copy Match) */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-700 font-bold">
                  <Scan className="w-4 h-4 text-royal-600" />
                  <span>أو امسح باركود نسخة الكتاب مباشرة للمطابقة الفورية:</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="امسح أو اكتب رمز النسخة مثل WTH-125-001..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) handleScanCopyDirectlyForReturn(val);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:ring-2 focus:ring-royal-500 text-right w-full sm:w-64"
                  />
                </div>
              </div>

              {/* List of Current Active Loans for this Student */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900">
                  الكتب المسجلة حالياً كإعارة لهذا الطالب (اختر الكتاب المراد إرجاعه):
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {returnStudentActiveLoans.map((loan) => {
                    const copy = copies.find((c) => c.id === loan.copyId);
                    const book = books.find((b) => b.id === copy?.bookId);
                    const late = isOverdue(loan.dueDate);

                    return (
                      <div
                        key={loan.id}
                        className={`p-5 rounded-3xl bg-white border-2 shadow-soft hover:shadow-card transition-all flex flex-col justify-between space-y-4 text-right ${
                          late ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="font-mono text-xs font-bold text-royal-700 bg-royal-50 px-2 py-0.5 rounded-md border border-royal-200">
                              {copy?.copyCode}
                            </span>
                            <h4 className="text-base font-black text-slate-900 leading-snug pt-1">
                              {book?.title}
                            </h4>
                            <span className="text-xs text-slate-500 block">
                              موقع الرف: {copy?.shelfLocation}
                            </span>
                          </div>

                          <div className="text-left shrink-0">
                            <span
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                                late ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {late ? 'متأخر عن الموعد' : 'ضمن المدة'}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-1">
                              الاستحقاق: {formatArabicDate(loan.dueDate)}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            تاريخ الاستعارة: {formatArabicDate(loan.loanDate)}
                          </span>

                          <Button
                            variant="royal"
                            size="sm"
                            icon={<RotateCcw className="w-4 h-4" />}
                            onClick={() => handleSelectLoanForReturn(loan)}
                            className="text-xs font-bold px-4"
                          >
                            تحديد هذا الكتاب للإرجاع
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INSPECT CONDITION & CONFIRM RETURN */}
          {returnStep === 'inspect' && returnSelectedLoan && returnSelectedCopy && returnSelectedBook && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-soft space-y-6">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-royal-100 text-royal-800 text-xs font-bold">
                  <PackageCheck className="w-4 h-4" />
                  <span>الخطوة 3: فحص حالة الكتاب وتأكيد الإرجاع</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-2">
                  فحص سلامة النسخة واعتماد الإرجاع
                </h3>
                <p className="text-xs text-slate-500">
                  تنتقل النسخة فوراً لحالة «قيد الفحص» على رف الإرجاع لحمايتها قبل إتاحتها من جديد.
                </p>
              </div>

              {/* Summary Card */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">الكتاب المسترجع:</span>
                  <h4 className="text-base font-black text-slate-900 mt-0.5">
                    {returnSelectedBook.title}
                  </h4>
                  <span className="font-mono text-xs text-royal-700 font-bold block mt-1">
                    رمز النسخة: {returnSelectedCopy.copyCode}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">الطالب المُعيد:</span>
                  <h4 className="text-base font-black text-slate-900 mt-0.5">
                    {returnStudent?.fullName}
                  </h4>
                  <span className="text-xs text-slate-500 block mt-1">
                    {returnStudent?.grade} ({returnStudent?.internalId})
                  </span>
                </div>
              </div>

              {/* Condition Assessment Form */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    نتيجة الفحص الميداني لحالة الكتاب الورقي: *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {[
                      { id: 'pristine', label: 'ممتاز ونظيف', desc: 'كالجديد تماماً' },
                      { id: 'good', label: 'سليم وجيد', desc: 'استخدام طبيعي معتاد' },
                      { id: 'needs_monitoring', label: 'يحتاج متابعة', desc: 'ملاحظات طفيفة' },
                      { id: 'damaged', label: 'متضرر', desc: 'يحتاج صيانة وتجليد' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setReturnCondition(item.id as ConditionRating)}
                        className={`p-3.5 rounded-2xl border text-right transition-all ${
                          returnCondition === item.id
                            ? 'bg-royal-600 text-white border-royal-600 shadow-soft'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-bold block">{item.label}</span>
                        <span
                          className={`text-[10px] block mt-0.5 ${
                            returnCondition === item.id ? 'text-royal-100' : 'text-slate-400'
                          }`}
                        >
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    ملاحظات الفحص والاستلام (اختياري):
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="اكتب أي ملاحظة عن حالة الأوراق أو الغلاف أو مكان وضعها على رف الفحص..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-royal-500 text-right"
                  />
                </div>
              </div>

              {/* Important Rule Notice */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  <strong>سياسة مكتبة وثبة:</strong> عند الضغط على تأكيد، يتم استلام الكتاب من الطالب فوراً وتنتقل النسخة إلى حالة <strong>«قيد الفحص (على رف الإرجاع)»</strong> لحين التأكد التام من سلامتها.
                </span>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setReturnStep('select_book')}
                  className="text-xs"
                >
                  العودة لقائمة الكتب
                </Button>

                <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={handleResetToIdle} className="text-xs">
                    إلغاء العملية
                  </Button>
                  <Button
                    variant="royal"
                    size="md"
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    onClick={handleConfirmReturn}
                    className="text-xs font-black px-6 shadow-soft"
                  >
                    تأكيد استرجاع الكتاب ونقله لرف الفحص 📦
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS RETURN SCREEN */}
          {returnStep === 'success' && returnStudent && returnSelectedCopy && returnSelectedBook && (
            <div className="bg-white rounded-3xl border-2 border-royal-300 p-8 shadow-card text-center space-y-6 animate-in zoom-in-95">
              <div className="w-20 h-20 rounded-3xl bg-royal-100 text-royal-700 flex items-center justify-center mx-auto shadow-soft">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-royal-50 text-royal-800 text-xs font-bold">
                  <Sparkles className="w-4 h-4 text-royal-600" />
                  <span>تم استلام الكتاب وتسجيل العملية في سجل التدقيق</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-2">
                  تم استرجاع الكتاب بنجاح!
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  تم إغلاق الإعارة للطالب «{returnStudent.fullName}» وانتقلت نسخة «{returnSelectedBook.title}» إلى حالة «قيد الفحص على رف الإرجاع».
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-right space-y-2">
                <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-slate-500">رمز النسخة:</span>
                  <span className="font-mono font-bold text-slate-800">{returnSelectedCopy.copyCode}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-slate-500">حالة النسخة الحالية:</span>
                  <span className="font-bold text-orange-700">قيد الفحص (على رف الإرجاع)</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                  <span className="text-slate-500">نتيجة الفحص الميداني:</span>
                  <span className="font-bold text-slate-800">{returnCondition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المشرف المستلم:</span>
                  <span className="font-bold text-slate-800">{supervisorName}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <Button
                  variant="royal"
                  size="md"
                  icon={<Scan className="w-4 h-4" />}
                  onClick={() => {
                    setReturnSelectedLoan(null);
                    setReturnSelectedCopy(null);
                    setReturnSelectedBook(null);
                    setReturnStep('select_book');
                  }}
                  className="font-bold"
                >
                  إرجاع كتاب آخر لهذا الطالب
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setReturnStudent(null);
                    setReturnSelectedLoan(null);
                    setReturnSelectedCopy(null);
                    setReturnSelectedBook(null);
                    setReturnStep('scan_student');
                  }}
                  className="font-bold"
                >
                  إرجاع كتاب لطالب آخر
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleResetToIdle}
                  className="font-bold"
                >
                  العودة لاختيار العملية
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
