import React, { useState } from 'react';
import { ReadingCertificate } from '../../../types';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import { formatUmmAlQuraDate, formatArabicDate } from '../../../lib/dateUtils';
import {
  downloadCertificatePdf,
  printCertificateHighQuality,
} from '../../../lib/certificatePdf';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import {
  Download,
  Printer,
  BookOpen,
  Crown,
  Sparkles,
  ShieldCheck,
  Award,
} from 'lucide-react';

interface CertificateViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: ReadingCertificate;
}

export const CertificateViewerModal: React.FC<CertificateViewerModalProps> = ({
  isOpen,
  onClose,
  certificate,
}) => {
  const { settings } = useLibrary();
  const { showToast } = useNotifications();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const isWathab = certificate.themeKeySnapshot === 'wathab';
  const primary = certificate.primaryColorSnapshot || '#3b707d';
  const accent = certificate.accentColorSnapshot || '#d4af37';
  const secondary = certificate.secondaryColorSnapshot || '#e3ecf3';

  const hijriDate = formatUmmAlQuraDate(certificate.issuedAt);
  const gregDate = formatArabicDate(certificate.issuedAt);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadCertificatePdf(certificate, settings.libraryName);
      showToast('تم تجهيز وتنزيل الشهادة بصيغة PDF بنجاح 📜', 'success');
    } catch (err: any) {
      showToast(err?.message || 'تعذر إنشاء ملف PDF للشهادة', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`معاينة الشهادة الرسمية — ${certificate.rankTitleSnapshot}`}
      subtitle={`رقم الشهادة الفريد: ${certificate.certificateNumber}`}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* أزرار التنزيل والطباعة العلوية */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              شهادة إلكترونية موثقة • الإصدار رقم #{certificate.version}
              {certificate.isReissue && certificate.reissueReason
                ? ` (${certificate.reissueReason})`
                : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => printCertificateHighQuality(certificate, settings.libraryName)}
              icon={<Printer className="w-4 h-4" />}
              className="text-xs font-bold"
            >
              طباعة بجودة عالية
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={downloadingPdf}
              onClick={handleDownloadPdf}
              icon={<Download className="w-4 h-4" />}
              className="bg-wathba-700 hover:bg-wathba-800 text-white text-xs font-bold"
            >
              تنزيل الشهادة (PDF)
            </Button>
          </div>
        </div>

        {/* قالب الشهادة المرئي الفاخر */}
        <div
          className="relative rounded-3xl p-4 sm:p-6 shadow-premium overflow-hidden"
          style={{
            background: isWathab
              ? 'linear-gradient(135deg, #fffdf5 0%, #fef9e7 50%, #fbf3d5 100%)'
              : `linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, ${secondary} 100%)`,
          }}
        >
          {/* الإطار المزدوج */}
          <div
            className="border-4 sm:border-[6px] rounded-2xl p-2 sm:p-3 relative"
            style={{ borderColor: primary }}
          >
            <div
              className="border-2 rounded-xl px-4 py-7 sm:px-10 sm:py-10 text-center space-y-5 relative overflow-hidden"
              style={{ borderColor: isWathab ? '#d4af37' : accent }}
            >
              {/* شعار مكتبة وثبة الذكية */}
              <div className="space-y-1.5 relative z-10">
                <div
                  className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-white border-4 shadow-soft"
                  style={{
                    backgroundColor: primary,
                    borderColor: '#d4af37',
                  }}
                >
                  {isWathab ? (
                    <Crown className="w-8 h-8 text-gold-300" />
                  ) : (
                    <BookOpen className="w-7 h-7 text-white" />
                  )}
                </div>
                <div
                  className="text-xs sm:text-sm font-black tracking-wide"
                  style={{ color: primary }}
                >
                  {certificate.issuerOrganization || settings.libraryName}
                </div>
                <h2
                  className={`text-2xl sm:text-4xl font-black tracking-tight ${
                    isWathab ? 'text-amber-900' : 'text-slate-900'
                  }`}
                >
                  شهادة إنجاز قرائي
                </h2>
                <div
                  className="w-36 h-1 rounded-full mx-auto"
                  style={{ backgroundColor: isWathab ? '#d4af37' : accent }}
                />
              </div>

              {/* اسم الطالب ومرتبته */}
              <div className="space-y-2.5 relative z-10">
                <p className="text-xs sm:text-sm font-bold text-slate-500">
                  تشهد إدارة المكتبة بكل فخر واعتزاز بأن الطالب المتميز:
                </p>
                <div
                  className="text-2xl sm:text-4xl font-black leading-snug"
                  style={{ color: primary }}
                >
                  {certificate.studentNameSnapshot}
                </div>
                {certificate.studentGradeSnapshot && (
                  <span className="text-xs font-bold text-slate-500 block">
                    {certificate.studentGradeSnapshot}
                  </span>
                )}

                <p className="text-xs sm:text-sm font-bold text-slate-700 pt-1">
                  قد أتمَّ بنجاح قراءة واعتماد (
                  <strong className="text-slate-950 font-black">
                    {certificate.pagesCompletedSnapshot.toLocaleString('ar-SA')} صفحة
                  </strong>
                  ) واستحق عن جدارة لقب:
                </p>

                {/* شارة اللقب */}
                <div className="py-1">
                  <span
                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full text-lg sm:text-2xl font-black border-[3px] shadow-soft"
                    style={{
                      backgroundColor: isWathab ? '#162b31' : primary,
                      color: isWathab ? '#fef08a' : '#ffffff',
                      borderColor: '#d4af37',
                    }}
                  >
                    {isWathab ? (
                      <Crown className="w-5 h-5 text-gold-400" />
                    ) : (
                      <Award className="w-5 h-5" />
                    )}
                    <span>{certificate.rankTitleSnapshot}</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-bold text-slate-700 max-w-xl mx-auto leading-relaxed pt-1">
                  {certificate.motivationalPhrase}
                </p>
              </div>

              {/* تذييل التوثيق والتوقيع */}
              <div className="pt-5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-xs relative z-10">
                <div className="text-center sm:text-right space-y-0.5">
                  <div className="font-black text-slate-900">
                    تاريخ الاستحقاق: {hijriDate}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    الموافق: {gregDate}
                  </div>
                  <div className="font-mono text-[11px] font-bold text-slate-600 pt-0.5">
                    رقم الشهادة: {certificate.certificateNumber}
                  </div>
                </div>

                <div className="flex justify-center">
                  <div
                    className="w-20 h-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center text-[10px] font-black leading-tight bg-white/70"
                    style={{ borderColor: primary, color: primary }}
                  >
                    <Sparkles className="w-3.5 h-3.5 mb-0.5 text-gold-600" />
                    <span>ختم الاعتماد</span>
                    <span>مكتبة وثبة</span>
                  </div>
                </div>

                <div className="text-center sm:text-left space-y-0.5">
                  <div className="font-bold text-slate-600">
                    {certificate.signatoryTitle}
                  </div>
                  <div
                    className="font-black text-sm"
                    style={{ color: primary }}
                  >
                    {certificate.signatoryName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {certificate.isReissue
                      ? `إعادة إصدار موثقة (#${certificate.version})`
                      : 'إصدار إلكتروني رسمي'}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 pt-2">
                {certificate.footerNote}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
