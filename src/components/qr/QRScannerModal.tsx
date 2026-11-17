import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Camera, Keyboard, AlertCircle, RefreshCw, Volume2, CheckCircle2 } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string, mode: 'checkout' | 'return' | 'inquiry') => void;
  initialMode?: 'checkout' | 'return' | 'inquiry';
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  initialMode = 'inquiry',
}) => {
  const [scanMode, setScanMode] = useState<'checkout' | 'return' | 'inquiry'>(initialMode);
  const [inputMethod, setInputMethod] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'wathba-qr-reader-viewport';

  useEffect(() => {
    setScanMode(initialMode);
  }, [initialMode]);

  // تشغيل نغمة تأكيد عند نجاح المسح
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // نغمة مرتفعة مبهجة
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // تجاهل إذا كان الصوت مقيداً بالمتصفح
    }
  };

  const handleScanHit = (text: string) => {
    if (!text) return;
    playBeep();
    setLastScanned(text);
    onScanSuccess(text.trim(), scanMode);
    // إغلاق النافذة بعد المسح بنجاح
    stopCamera();
    onClose();
  };

  // تهيئة كاميرا المسح
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      const scanConfig = {
        fps: 10,
        qrbox: (vw: number, vh: number) => {
          const minEdge = Math.min(vw, vh);
          if (minEdge <= 0) return { width: 180, height: 180 };
          const size = Math.max(100, Math.min(240, Math.floor(minEdge * 0.72)));
          const safeSize = Math.max(50, Math.min(size, minEdge - 16));
          return { width: safeSize, height: safeSize };
        },
        aspectRatio: 1.0,
      };

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          scanConfig,
          (decodedText) => {
            handleScanHit(decodedText);
          },
          () => {
            // تجاهل أخطاء عدم تطابق الفريم
          }
        );
      } catch (primaryErr) {
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (!cameras || cameras.length === 0) throw primaryErr;
        const preferred =
          cameras.find((c) => /back|rear|environment|خلف/i.test(c.label)) ||
          cameras[cameras.length - 1];
        await html5QrCode.start(
          preferred.id,
          scanConfig,
          (decodedText) => {
            handleScanHit(decodedText);
          },
          () => {}
        );
      }
      setIsScanning(true);
    } catch (err: any) {
      console.warn('Camera initiation failed:', err);
      setCameraError('تعذر فتح الكاميرا (يرجى السماح بالوصول أو استخدام الإدخال اليدوي)');
      setIsScanning(false);
      setInputMethod('manual');
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        // Ignored
      }
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen && inputMethod === 'camera') {
      // إعطاء مهلة للمودال حتى يتم عرضه في DOM
      const timer = setTimeout(() => {
        startCamera();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, inputMethod]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScanHit(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title="المسح الذكي للباركود وQR"
      subtitle="امسح ملصق الكتاب أو بطاقة الطالب لتنفيذ الإجراء فوراً"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* أزرار اختيار وضع المسح المطلوب */}
        <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setScanMode('checkout')}
            className={`py-2 px-2 text-xs font-bold rounded-lg transition-all ${
              scanMode === 'checkout'
                ? 'bg-wathba-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تسليم كتاب
          </button>
          <button
            type="button"
            onClick={() => setScanMode('return')}
            className={`py-2 px-2 text-xs font-bold rounded-lg transition-all ${
              scanMode === 'return'
                ? 'bg-royal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            استرجاع كتاب
          </button>
          <button
            type="button"
            onClick={() => setScanMode('inquiry')}
            className={`py-2 px-2 text-xs font-bold rounded-lg transition-all ${
              scanMode === 'inquiry'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الاستعلام السريع
          </button>
        </div>

        {/* التبديل بين الكاميرا والإدخال اليدوي */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setInputMethod('camera')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                inputMethod === 'camera'
                  ? 'bg-slate-200 text-slate-800 font-bold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              كاميرا الجهاز
            </button>
            <button
              onClick={() => setInputMethod('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                inputMethod === 'manual'
                  ? 'bg-slate-200 text-slate-800 font-bold'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              إدخال الرمز يدوياً
            </button>
          </div>
          {inputMethod === 'camera' && (
            <button
              onClick={startCamera}
              className="text-slate-500 hover:text-wathba-600 p-1"
              title="إعادة تشغيل الكاميرا"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* عرض الكاميرا الحية */}
        {inputMethod === 'camera' && (
          <div className="relative w-full max-w-[270px] sm:max-w-[320px] mx-auto rounded-2xl overflow-hidden bg-slate-900 aspect-square flex items-center justify-center border-2 border-[#3b707d]">
            <div id={scannerContainerId} className="w-full h-full"></div>

            {/* إطار المسح والتوجيه */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-52 h-52 border-2 border-emerald-400/80 rounded-2xl relative shadow-lg">
                <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></span>
                <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></span>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></span>
                <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></span>
              </div>
            </div>

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/85 p-6 flex flex-col items-center justify-center text-center text-rose-300 gap-2">
                <AlertCircle className="w-8 h-8 text-rose-400" />
                <p className="text-xs leading-relaxed">{cameraError}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setInputMethod('manual')}
                  className="mt-2 text-xs"
                >
                  الانتقال للإدخال اليدوي
                </Button>
              </div>
            )}
          </div>
        )}

        {/* نموذج الإدخال اليدوي */}
        {inputMethod === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-3 py-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رمز النسخة أو رقم QR أو رمز الطالب:
              </label>
              <input
                type="text"
                autoFocus
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="مثال: WTH-125-001 أو STU-1001"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-wathba-500 font-mono text-center text-base"
              />
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              💡 <strong>أمثلة للاختبار السريع:</strong>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span
                  onClick={() => setManualCode('WTH-125-001')}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-xs cursor-pointer hover:bg-slate-100"
                >
                  WTH-125-001
                </span>
                <span
                  onClick={() => setManualCode('WTH-126-001')}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-xs cursor-pointer hover:bg-slate-100"
                >
                  WTH-126-001
                </span>
                <span
                  onClick={() => setManualCode('STU-1001')}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300 font-mono text-xs cursor-pointer hover:bg-slate-100"
                >
                  STU-1001
                </span>
              </div>
            </div>
            <Button type="submit" variant="primary" className="w-full" size="md">
              تنفيذ ومتابعة
            </Button>
          </form>
        )}

        {/* إشعار آخر مسح */}
        {lastScanned && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>تم التعرف على: <strong>{lastScanned}</strong></span>
          </div>
        )}
      </div>
    </Modal>
  );
};
