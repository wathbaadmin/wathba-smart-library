import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import { ReadingCertificate } from '../../../types';
import {
  downloadCertificatePdf,
  printCertificateHighQuality,
} from '../../../lib/certificatePdf';
import { formatUmmAlQuraDate, formatArabicDate } from '../../../lib/dateUtils';
import { RankEmblem } from './RankEmblem';
import { CertificateViewerModal } from './CertificateViewerModal';
import { RankCelebrationModal } from './RankCelebrationModal';
import { Button } from '../../common/Button';
import {
  Award,
  Crown,
  BookOpen,
  ScrollText,
  Sparkles,
  CheckCircle2,
  Clock,
  Lock,
  XCircle,
  Download,
  Printer,
  Eye,
  History,
  FileCheck,
  Calendar,
} from 'lucide-react';

type StudentRanksSubTab = 'ranks' | 'certificates' | 'logs';

export const RanksAndCertificatesView: React.FC = () => {
  const { currentStudent } = useAuth();
  const {
    settings,
    readingRanks,
    readingLogs,
    readingLogCorrections,
    books,
    getStudentRankSummary,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [subTab, setSubTab] = useState<StudentRanksSubTab>('ranks');
  const [viewerCert, setViewerCert] = useState<ReadingCertificate | null>(null);
  const [celebrationTarget, setCelebrationTarget] = useState<{
    achievementId: string;
    rankId: string;
  } | null>(null);

  const summary = currentStudent
    ? getStudentRankSummary(currentStudent.id)
    : null;

  // إظهار نافذة التهنئة تلقائياً عند استحقاق لقب جديد لم يُحتفل به بعد
  useEffect(() => {
    if (
      summary &&
      summary.uncelebratedAchievements.length > 0 &&
      !celebrationTarget
    ) {
      const latest =
        summary.uncelebratedAchievements[
          summary.uncelebratedAchievements.length - 1
        ];
      setCelebrationTarget({
        achievementId: latest.id,
        rankId: latest.rankId,
      });
    }
  }, [summary?.uncelebratedAchievements.length]);

  if (!currentStudent || !summary) return null;

  const myReadingLogs = (readingLogs || []).filter(
    (l) => l.studentId === currentStudent.id
  );
  const myCorrections = (readingLogCorrections || []).filter(
    (c) => c.studentId === currentStudent.id
  );

  const celebrationAchievement = celebrationTarget
    ? summary.uncelebratedAchievements.find(
        (a) => a.id === celebrationTarget.achievementId
      )
    : undefined;
  const celebrationRank = celebrationTarget
    ? readingRanks.find((r) => r.id === celebrationTarget.rankId)
    : undefined;
  const celebrationCert = celebrationTarget
    ? summary.certificates.find(
        (c) => c.rankId === celebrationTarget.rankId && c.status === 'active'
      )
    : undefined;

  const handleQuickDownload = async (cert: ReadingCertificate) => {
    try {
      await downloadCertificatePdf(cert, settings.libraryName);
      showToast('تم تنزيل الشهادة بصيغة PDF بنجاح 📜', 'success');
    } catch {
      showToast('تعذر إنشاء ملف PDF', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. بطاقة البطل الأكاديمية العلوية */}
      <div
        className={`relative rounded-3xl p-6 sm:p-8 text-white shadow-card overflow-hidden ${
          summary.isWathabAchieved
            ? 'bg-gradient-to-l from-[#162b31] via-[#27434b] to-[#92400e] border-2 border-gold-400'
            : 'bg-gradient-to-l from-[#27434b] via-[#3b707d] to-[#325d68]'
        }`}
      >
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-gold-400/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 text-right">
              {summary.currentRank ? (
                <RankEmblem
                  themeKey={summary.currentRank.themeKey}
                  primaryColor={summary.currentRank.primaryColor}
                  accentColor={summary.currentRank.accentColor}
                  status="earned"
                  size="lg"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                  <Award className="w-9 h-9 text-gold-300" />
                </div>
              )}

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-[11px] font-bold text-gold-300">
                  {summary.isWathabAchieved ? (
                    <>
                      <Crown className="w-3.5 h-3.5" />
                      <span>أعلى مرتبة في المكتبة • القارئ الوثّاب 👑</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>سُلّم الألقاب والشهادات القرائية</span>
                    </>
                  )}
                </div>

                <h2 className="text-xl sm:text-3xl font-black text-white leading-tight">
                  {summary.currentRank
                    ? `لقبك الحالي: ${summary.currentRank.title}`
                    : `أهلاً بالقارئ الطموح ${currentStudent.fullName}! 📚`}
                </h2>
                <p className="text-xs text-wathba-100">
                  {summary.currentRank
                    ? summary.currentRank.motivationalPhrase
                    : 'يتم تسجيل واعتماد صفحات قراءتك عبر مشرف المكتبة لتحصد الألقاب الخمسة وشهاداتها المعتمدة!'}
                </p>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-right shrink-0">
              <span className="text-[11px] font-bold text-[#e3ecf3] block">
                اعتماد الصفحات
              </span>
              <span className="text-xs font-black text-gold-300">
                يُوثَّق عبر مشرف المكتبة
              </span>
            </div>
          </div>

          {/* وسام وثّاب الرقمي الحصري عند بلوغ القمة */}
          {summary.isWathabAchieved && (
            <div className="p-4 rounded-2xl bg-gradient-to-l from-amber-500/25 to-gold-400/15 border border-gold-300/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gold-400 text-slate-950 flex items-center justify-center shrink-0 shadow-soft">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-black text-gold-200 block">
                    وسام «وثّاب» الذهبي الرقمي الحصري مفعّل في ملف إنجازاتك! ✨
                  </span>
                  <span className="text-[11px] text-wathba-100">
                    لقد تخطيت قمة القراءة في مكتبة وثبة وأصبحت قدوة لزملائك.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-right">
              <span className="text-[11px] text-wathba-100 block">إجمالي الصفحات المعتمدة</span>
              <strong className="text-2xl font-black text-gold-300 block mt-0.5">
                {summary.totalApprovedPages.toLocaleString('ar-SA')} صفحة
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-right">
              <span className="text-[11px] text-wathba-100 block">الرتب المستحقة</span>
              <strong className="text-2xl font-black text-white block mt-0.5">
                {summary.tiers.filter((t) => t.status === 'earned').length} / {summary.tiers.length}
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-right">
              <span className="text-[11px] text-wathba-100 block">الشهادات المعتمدة</span>
              <strong className="text-2xl font-black text-emerald-300 block mt-0.5">
                {summary.certificates.length} شهادة
              </strong>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-right">
              <span className="text-[11px] text-wathba-100 block">الكتب المكتملة ونقاط المناقشات</span>
              <strong className="text-xl font-black text-white block mt-0.5">
                {summary.completedBooksCount} كتاب • <span className="text-gold-300">{summary.discussionPoints} نقطة</span>
              </strong>
            </div>
          </div>

          {/* شريط التقدم نحو اللقب التالي */}
          <div className="p-4 rounded-2xl bg-black/20 border border-white/15 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <span>
                {summary.nextRank ? (
                  <>
                    بقي لك{' '}
                    <strong className="text-gold-300 text-sm">
                      {summary.remainingPagesToNext.toLocaleString('ar-SA')} صفحة
                    </strong>{' '}
                    للحصول على لقب{' '}
                    <strong className="text-white underline decoration-gold-400">
                      {summary.nextRank.title}
                    </strong>
                  </>
                ) : (
                  <span className="text-gold-300 flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    مبارك! حصلت على جميع الألقاب القرائية وصولاً إلى «وثّاب»! 🎉
                  </span>
                )}
              </span>

              <span className="text-gold-200 font-black">
                {summary.progressPercentToNext}%
              </span>
            </div>

            <div className="w-full h-3.5 bg-white/15 rounded-full p-0.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-l from-gold-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${summary.progressPercentToNext}%` }}
              />
            </div>

            {summary.pendingPagesCount > 0 && (
              <div className="text-[11px] text-amber-200 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  لديك ({summary.pendingPagesCount} صفحة) بانتظار اعتماد مشرف المكتبة.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. شريط التبويبات الفرعية */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-soft">
        <button
          type="button"
          onClick={() => setSubTab('ranks')}
          className={`flex-1 min-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            subTab === 'ranks'
              ? 'bg-[#3b707d] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>الألقاب القرائية ({summary.tiers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('certificates')}
          className={`flex-1 min-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            subTab === 'certificates'
              ? 'bg-[#3b707d] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ScrollText className="w-4 h-4" />
          <span>شهاداتي المعتمدة ({summary.certificates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('logs')}
          className={`flex-1 min-w-[140px] min-h-[44px] py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            subTab === 'logs'
              ? 'bg-[#3b707d] text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>سجل قراءاتي ({myReadingLogs.length})</span>
        </button>
      </div>

      {/* 3. TAB A: الألقاب القرائية الخمسة المتدرجة */}
      {subTab === 'ranks' && (
        <div className="space-y-4">
          {summary.tiers.map((tier, idx) => {
            const { rank, status, progressPercent, remainingPages, pagesCompletedTowardTier, achievement, certificate } = tier;
            const isCurrentRank = summary.currentRank?.id === rank.id;
            const isWathab = rank.isHighestTier || rank.themeKey === 'wathab';

            return (
              <div
                key={rank.id}
                className={`rounded-3xl border-2 p-5 sm:p-6 transition-all relative overflow-hidden ${
                  isWathab
                    ? status === 'earned'
                      ? 'bg-gradient-to-l from-[#fffdf5] via-[#fef9e7] to-white border-gold-400 shadow-premium'
                      : 'bg-gradient-to-l from-amber-50/40 to-white border-amber-300/70 shadow-soft'
                    : isCurrentRank
                    ? 'bg-white border-wathba-600 ring-2 ring-wathba-100 shadow-card'
                    : status === 'earned'
                    ? 'bg-white border-emerald-200 shadow-soft'
                    : status === 'in_progress'
                    ? 'bg-white border-amber-300 shadow-soft'
                    : 'bg-slate-50/70 border-slate-200 opacity-90'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* اليمين: الشعار + معلومات اللقب */}
                  <div className="flex items-start gap-4 flex-1 text-right">
                    <RankEmblem
                      themeKey={rank.themeKey}
                      primaryColor={rank.primaryColor}
                      accentColor={rank.accentColor}
                      status={status}
                      size="md"
                    />

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          المستوى #{idx + 1}
                        </span>
                        <h3 className="text-lg font-black text-slate-900">
                          {rank.title}
                        </h3>

                        {isWathab && (
                          <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#162b31] to-[#b45309] text-gold-200 text-[10px] font-black border border-gold-400 flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            <span>التصنيف الأعلى</span>
                          </span>
                        )}

                        {isCurrentRank && (
                          <span className="px-2.5 py-0.5 rounded-full bg-wathba-700 text-white text-[10px] font-black">
                            لقبك الحالي ⭐
                          </span>
                        )}

                        {/* حالة اللقب */}
                        {status === 'earned' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مستحق</span>
                          </span>
                        )}
                        {status === 'in_progress' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>قيد الإنجاز</span>
                          </span>
                        )}
                        {status === 'locked' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>مقفل</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed">
                        {rank.description}
                      </p>

                      {isWathab && (
                        <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-gold-600 shrink-0" />
                          <span>يمنح وسام رقمي خاص وحصري لا يتوفر في المستويات السابقة: «{rank.badgeTitle}»</span>
                        </p>
                      )}

                      {/* شريط التقدم نحو هذا اللقب */}
                      <div className="pt-2 space-y-1.5 max-w-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                          <span className="text-slate-700">
                            المطلوب: {rank.requiredPages.toLocaleString('ar-SA')} صفحة •{' '}
                            <span className="text-wathba-700">
                              أنجزت: {pagesCompletedTowardTier.toLocaleString('ar-SA')} صفحة
                            </span>
                          </span>
                          <span
                            className={
                              status === 'earned' ? 'text-emerald-700' : 'text-amber-700'
                            }
                          >
                            {progressPercent}%
                          </span>
                        </div>

                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressPercent}%`,
                              backgroundColor:
                                status === 'earned'
                                  ? '#059669'
                                  : isWathab
                                  ? '#d97706'
                                  : rank.primaryColor,
                            }}
                          />
                        </div>

                        {status === 'earned' && achievement ? (
                          <div className="text-[11px] text-emerald-700 font-bold">
                            تاريخ الحصول على اللقب: {formatUmmAlQuraDate(achievement.unlockedAt)} ({formatArabicDate(achievement.unlockedAt)})
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-600 font-bold">
                            بقي لك <strong className="text-wathba-800">{remainingPages.toLocaleString('ar-SA')} صفحة</strong> للحصول على لقب {rank.title}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* اليسار: أزرار الشهادة إذا كان مستحقاً */}
                  {status === 'earned' && certificate && (
                    <div className="flex sm:flex-row lg:flex-col items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setViewerCert(certificate)}
                        icon={<Eye className="w-4 h-4" />}
                        className={`w-full text-xs font-bold ${
                          isWathab
                            ? 'bg-gradient-to-r from-[#162b31] to-[#92400e] text-gold-200 border border-gold-400'
                            : 'bg-wathba-700 text-white'
                        }`}
                      >
                        عرض الشهادة
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuickDownload(certificate)}
                        icon={<Download className="w-4 h-4" />}
                        className="w-full text-xs font-bold"
                      >
                        تنزيل PDF
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. TAB B: أرشيف الشهادات الصادرة */}
      {subTab === 'certificates' && (
        <div className="space-y-4">
          {summary.certificates.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-soft">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <ScrollText className="w-8 h-8" />
              </div>
              <h4 className="font-black text-base text-slate-800">
                لم تصدر لك شهادات ألقاب بعد
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                عند إتمام {summary.tiers[0]?.rank.requiredPages || 100} صفحة معتمدة ستحصل فوراً على شهادة «{summary.tiers[0]?.rank.title || 'دبلوم القراءة'}» الإلكترونية الرسمية!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.certificates.map((cert) => {
                const isWathab = cert.themeKeySnapshot === 'wathab';
                return (
                  <div
                    key={cert.id}
                    className={`rounded-3xl border-2 p-5 shadow-soft flex flex-col justify-between space-y-4 ${
                      isWathab
                        ? 'bg-gradient-to-br from-[#fffdf5] to-[#fef3c7] border-gold-400'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-black text-white"
                            style={{ backgroundColor: cert.primaryColorSnapshot }}
                          >
                            {cert.rankTitleSnapshot}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500 font-bold">
                            {cert.certificateNumber}
                          </span>
                          {cert.status === 'archived' && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold">
                              نسخة سابقة محفوظة
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-sm text-slate-900">
                          شهادة إنجاز قرائي — {cert.rankTitleSnapshot}
                        </h4>
                        <p className="text-xs text-slate-500">
                          بإتمام {cert.pagesCompletedSnapshot.toLocaleString('ar-SA')} صفحة معتمدة • الإصدار #{cert.version}
                        </p>
                      </div>

                      <RankEmblem
                        themeKey={cert.themeKeySnapshot}
                        primaryColor={cert.primaryColorSnapshot}
                        accentColor={cert.accentColorSnapshot}
                        status="earned"
                        size="sm"
                      />
                    </div>

                    <div className="text-[11px] text-slate-500 border-t border-slate-200/70 pt-3 flex flex-wrap items-center justify-between gap-2">
                      <span>صدرت في: {formatUmmAlQuraDate(cert.issuedAt)}</span>
                      <span>الجهة: {cert.signatoryTitle}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setViewerCert(cert)}
                        icon={<Eye className="w-3.5 h-3.5" />}
                        className="bg-wathba-700 text-white text-xs font-bold"
                      >
                        عرض
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuickDownload(cert)}
                        icon={<Download className="w-3.5 h-3.5" />}
                        className="text-xs font-bold"
                      >
                        PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printCertificateHighQuality(cert, settings.libraryName)}
                        icon={<Printer className="w-3.5 h-3.5" />}
                        className="text-xs font-bold"
                      >
                        طباعة
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB C: سجل قراءاتي المعتمدة */}
      {subTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-black text-base text-slate-900">
                سجل عمليات القراءة المرتبطة بالكتب
              </h3>
              <p className="text-xs text-slate-500">
                تُسجَّل وتُعتمد صفحات القراءة من قِبل مشرف المكتبة وتُضاف تلقائياً إلى رصيدك
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#e3ecf3]/70 text-[#284d57] text-xs font-bold self-start sm:self-auto">
              <FileCheck className="w-4 h-4 text-[#3b707d]" />
              <span>التسجيل والاعتماد عبر المشرف</span>
            </span>
          </div>

          {myReadingLogs.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">لا توجد صفحات قراءة مسجلة في رصيدك بعد</p>
              <p className="text-xs">تواصل مع مشرف المكتبة لتوثيق واعتماد صفحات قراءتك والوصول إلى دبلوم القراءة!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myReadingLogs.map((log) => {
                const book = books.find((b) => b.id === log.bookId);
                return (
                  <div
                    key={log.id}
                    className={`p-4 rounded-2xl border space-y-2 ${
                      log.status === 'approved'
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : log.status === 'pending'
                        ? 'bg-amber-50/40 border-amber-200'
                        : log.status === 'rejected'
                        ? 'bg-rose-50/40 border-rose-200'
                        : 'bg-slate-50 border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <BookOpen className="w-4 h-4 text-wathba-700 shrink-0" />
                        <span className="font-black text-xs sm:text-sm text-slate-900">
                          {book?.title || 'كتاب مستعار'}
                        </span>
                        <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 font-bold text-slate-700">
                          صفحة {log.fromPage} إلى {log.toPage} ({log.pagesCount} ص)
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {log.readingDate}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {log.status === 'approved' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>معتمد (+{log.pagesCount} صفحة)</span>
                          </span>
                        )}
                        {log.status === 'pending' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>بانتظار مراجعة المشرف</span>
                          </span>
                        )}
                        {log.status === 'rejected' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>مرفوض (لم يُحتسب)</span>
                          </span>
                        )}
                        {log.status === 'superseded' && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1">
                            <History className="w-3.5 h-3.5" />
                            <span>مُحدَّث بتصحيح موثق</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {log.studentNotes && (
                      <p className="text-[11px] text-slate-600">
                        <strong className="text-slate-700">ملخصك:</strong> {log.studentNotes}
                      </p>
                    )}

                    {log.status === 'rejected' && log.rejectionReason && (
                      <p className="text-xs text-rose-800 bg-rose-50 p-2 rounded-xl border border-rose-200 font-bold">
                        سبب الرفض من المشرف: {log.rejectionReason}
                      </p>
                    )}
                  </div>
                );
              })}

              {myCorrections.length > 0 && (
                <div className="pt-4 border-t border-slate-200 space-y-2">
                  <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-wathba-700" />
                    <span>سجل التصحيحات الإدارية الموثقة:</span>
                  </h4>
                  {myCorrections.map((corr) => (
                    <div
                      key={corr.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                    >
                      <div className="font-bold text-slate-800">
                        تعديل الصفحات من {corr.previousPagesCount} إلى {corr.newPagesCount} صفحة (فرق:{' '}
                        {corr.pagesDelta >= 0 ? `+${corr.pagesDelta}` : corr.pagesDelta} ص)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        السبب: {corr.reason} • المشرف: {corr.staffName} • {formatUmmAlQuraDate(corr.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {viewerCert && (
        <CertificateViewerModal
          isOpen={!!viewerCert}
          onClose={() => setViewerCert(null)}
          certificate={viewerCert}
        />
      )}

      {celebrationAchievement && celebrationRank && (
        <RankCelebrationModal
          isOpen={true}
          onClose={() => setCelebrationTarget(null)}
          studentId={currentStudent.id}
          achievement={celebrationAchievement}
          rank={celebrationRank}
          certificate={celebrationCert}
          onViewCertificate={(cert) => setViewerCert(cert)}
        />
      )}
    </div>
  );
};
