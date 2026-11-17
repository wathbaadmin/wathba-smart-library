import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';

export interface MidadLogoProps {
  className?: string;
  variant?: 'full' | 'mark' | 'icon';
  theme?: 'dark' | 'white' | 'currentColor';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  src?: string;
}

// كاش في الذاكرة لتخزين نسخ الشعار المفرغة الشفافة وتجنب إعادة معالجتها في كل رندر
const transparentLogoCache = new Map<string, string>();

/**
 * الشعار الرسمي المعتمد لمكتبة مداد (MIDAD Smart Library)
 * يعتمد صورة الشعار الأصلية المرفوعة 100%، ويقوم تلقائياً بتفريغ الخلفية البيضاء (Chroma-Key)
 * وقص الحواف الزائدة (Auto-Crop) لجعل الشعار فائق الوضوح والدقة وبدون أي مربعات أو خلفيات بيضاء.
 */
export const MidadLogo: React.FC<MidadLogoProps> = ({
  className = '',
  variant = 'full',
  theme = 'dark',
  size = 'md',
  src,
}) => {
  const { settings } = useLibrary();
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // استخدام الصورة المخصصة، أو المسجلة في الإعدادات، أو الملف المعتمد الافتراضي في public/midad-logo.jpg
  const activeImageSrc = src || settings?.logoUrl || '/midad-logo.jpg';
  const cacheKey = `${activeImageSrc}_${theme}_${variant}`;

  useEffect(() => {
    if (!activeImageSrc) {
      setProcessedUrl(null);
      return;
    }

    // إذا كانت النتيجة محفوظة في الكاش، استخدمها فوراً
    if (transparentLogoCache.has(cacheKey)) {
      setProcessedUrl(transparentLogoCache.get(cacheKey)!);
      return;
    }

    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = activeImageSrc;

    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;
        if (!origW || !origH) return;

        // 1. رسم الصورة على كانفاس أولي لقراءة البيكسلات
        const canvas = document.createElement('canvas');
        canvas.width = origW;
        canvas.height = origH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, origW, origH);
        const data = imgData.data;

        // تحديد حدود الشعار الفعلية لحذف الفراغات البيضاء المحيطة (Auto-Crop Bounding Box)
        let minX = origW;
        let minY = origH;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < origH; y++) {
          for (let x = 0; x < origW; x++) {
            const idx = (y * origW + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const brightness = (r + g + b) / 3;

            // إذا كان البيكسل أبيض أو فاتح جداً (خلفية)
            if (brightness > 232) {
              data[idx + 3] = 0; // شفافية كاملة 100%
            } else {
              // بيكسل ينتمي للشعار
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;

              if (brightness > 195) {
                // تنعيم حواف الشعار الشفافة (Anti-aliasing feathering)
                const alphaFactor = (232 - brightness) / 37;
                data[idx + 3] = Math.round(data[idx + 3] * alphaFactor);
              }

              // إذا كان النمط المطلوب أبيض ناصع (للخلفيات الداكنة والفخمة)
              if (theme === 'white' && data[idx + 3] > 0) {
                const darkness = 1 - brightness / 232;
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
                // تدرج الشفافية للحفاظ على جمال الخطوط الداخلية والسطر التعريفي
                data[idx + 3] = Math.round(data[idx + 3] * Math.min(1, Math.max(0.65, darkness * 1.3)));
              }
            }
          }
        }

        // إذا وُجد محتوى
        if (maxX >= minX && maxY >= minY) {
          // إضافة هوامش تنفس صغيرة جداً حول الشعار (Padding)
          const pad = 12;
          const cropX = Math.max(0, minX - pad);
          const cropY = Math.max(0, minY - pad);
          const cropW = Math.min(origW - cropX, maxX - minX + pad * 2);
          const cropH = Math.min(origH - cropY, maxY - minY + pad * 2);

          // وضع البيانات المعالجة على الكانفاس الأصلي
          ctx.putImageData(imgData, 0, 0);

          // قص الشعار على كانفاس ثانٍ بحجمه الدقيق بدون أي مساحات فارغة
          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropW;
          croppedCanvas.height = cropH;
          const croppedCtx = croppedCanvas.getContext('2d');
          if (croppedCtx) {
            croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const dataUrl = croppedCanvas.toDataURL('image/png');
            transparentLogoCache.set(cacheKey, dataUrl);
            if (isMounted) {
              setProcessedUrl(dataUrl);
              setFailed(false);
            }
            return;
          }
        }

        // في حال تعذر القص الدقيق، حفظ الكانفاس المفرغ كما هو
        ctx.putImageData(imgData, 0, 0);
        const fallbackUrl = canvas.toDataURL('image/png');
        transparentLogoCache.set(cacheKey, fallbackUrl);
        if (isMounted) {
          setProcessedUrl(fallbackUrl);
          setFailed(false);
        }
      } catch (err) {
        // في حال منع المتصفح استخراج البيكسلات، استخدام الصورة المباشرة
        if (isMounted) {
          setProcessedUrl(activeImageSrc);
        }
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setFailed(true);
        setProcessedUrl(null);
      }
    };

    return () => {
      isMounted = false;
    };
  }, [activeImageSrc, cacheKey, theme, variant]);

  // فئات الحجم المتناسقة
  const sizeClasses = {
    xs: 'h-6 sm:h-7 w-auto',
    sm: 'h-8 sm:h-10 w-auto',
    md: 'h-12 sm:h-14 w-auto',
    lg: 'h-16 sm:h-20 w-auto',
    xl: 'h-20 sm:h-28 w-auto',
    custom: '',
  }[size];

  // إذا تم استخراج الشعار الأصلي المفرغ والشفاف بنجاح (وهو الوضع الأساسي)
  if (processedUrl && !failed) {
    return (
      <img
        src={processedUrl}
        alt="شعار مكتبة مداد | MIDAD"
        className={`object-contain bg-transparent select-none pointer-events-none transition-all duration-200 ${sizeClasses} ${className}`}
        style={{ background: 'transparent' }}
      />
    );
  }

  // في حال لم تتوفر الصورة إطلاقاً، إرجاع عنصر نصي بسيط وأنيق
  return (
    <div
      className={`inline-flex items-center gap-2 font-black ${
        theme === 'white' ? 'text-white' : 'text-[#1b3247]'
      } ${sizeClasses} ${className}`}
    >
      <span className="text-xl sm:text-2xl font-bold tracking-tight">مِداد</span>
      <span className="text-xs opacity-75 font-mono">| MIDAD</span>
    </div>
  );
};
