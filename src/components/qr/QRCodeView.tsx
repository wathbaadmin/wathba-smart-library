import React, { useEffect, useState } from 'react';
import { generateQRCodeDataUrl } from '../../lib/qrGenerator';
import { Download } from 'lucide-react';

interface QRCodeViewProps {
  value: string;
  size?: number;
  label?: string;
  showDownload?: boolean;
  className?: string;
}

export const QRCodeView: React.FC<QRCodeViewProps> = ({
  value,
  size = 180,
  label,
  showDownload = false,
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (value) {
      generateQRCodeDataUrl(value).then(setDataUrl);
    }
  }, [value]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${label || 'wathba'}.png`;
    a.click();
  };

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-xs animate-pulse"
      >
        جارٍ تجهيز الـ QR...
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="p-2 bg-white rounded-2xl shadow-xs border border-slate-200 inline-block">
        <img
          src={dataUrl}
          alt={label || 'QR Code'}
          style={{ width: size, height: size }}
          className="rounded-lg object-contain"
        />
      </div>
      {label && <span className="text-xs font-mono font-bold text-slate-700">{label}</span>}
      {showDownload && (
        <button
          onClick={handleDownload}
          className="text-xs text-wathba-700 hover:text-wathba-800 flex items-center gap-1 font-medium mt-1"
        >
          <Download className="w-3.5 h-3.5" />
          تحميل صورة الرمز
        </button>
      )}
    </div>
  );
};
