import React from 'react';
import {
  Student,
  ReadingRankDefinition,
  StudentRankAchievement,
  ReadingCertificate,
  AchievementSettings,
} from '../../types';
import { RankEmblem } from '../student/ranks/RankEmblem';
import { formatArabicDate, formatUmmAlQuraDate } from '../../lib/dateUtils';
import { getStudentAvatarGradient, getStudentInitials } from '../../lib/achievementService';
import {
  X,
  Trophy,
  Award,
  BookOpen,
  CheckCircle2,
  Lock,
  Sparkles,
  Calendar,
  GraduationCap,
  ShieldCheck,
  Flame,
} from 'lucide-react';

export interface StudentAchievementProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  displayName: string;
  rankSummary: {
    totalApprovedPages: number;
    completedBooksCount: number;
    currentRank: ReadingRankDefinition | null;
    nextRank: ReadingRankDefinition | null;
    remainingPagesToNext: number;
    progressPercentToNext: number;
    isWathabAchieved: boolean;
    discussionPoints?: number;
  } | null;
  readingRanks: ReadingRankDefinition[];
  studentAchievements: StudentRankAchievement[];
  studentCertificates: ReadingCertificate[];
  achievementSettings: AchievementSettings;
}

export const StudentAchievementProfileModal: React.FC<StudentAchievementProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  displayName,
  rankSummary,
  readingRanks,
  studentAchievements,
  studentCertificates,
  achievementSettings,
}) => {
  if (!isOpen || !student || !rankSummary) return null;

  const gradient = getStudentAvatarGradient(student.id);
  const initials = getStudentInitials(student.fullName);

  const activeRanksSorted = [...(readingRanks || [])]
    .filter((r) => r.isActive)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.requiredPages - b.requiredPages);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* رأس النافذة المزخرف */}
        <div className="relative bg-gradient-to-l from-[#1c353d] via-[#284d57] to-[#3b707d] p-6 text-white overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-right">
            {/* أفاتار الطالب */}
            <div className="relative">
              <div
                className={`w-20 h-20 rounded-2xl bg-gradient-to-tr ${gradient.from} ${gradient.to} border-4 border-white/20 shadow-xl flex items-center justify-center text-white text-2xl font-black`}
              >
                {initials}
              </div>
              {rankSummary.currentRank && (
                <div className="absolute -bottom-2 -left-2">
                  <RankEmblem
                    themeKey={rankSummary.currentRank.themeKey}
                    size="sm"
                    isHighest={rankSummary.isWathabAchieved}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-xl font-black tracking-tight text-white">{displayName}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold text-white/90">
                  {student.grade} • {student.groupName}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-400/20 text-amber-200 border border-amber-400/30 font-bold">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>{rankSummary.currentRank?.title || 'قارئ مبتدئ'}</span>
                </span>

                {rankSummary.isWathabAchieved && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/30 text-purple-200 border border-purple-400/30 font-black text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-spin" />
                    <span>فارس وثّاب معتمد</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* جسم النافذة القابل للتمرير */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {/* كروت الإحصائيات الأربعة السريعة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] text-center">
              <span className="text-[11px] font-bold text-slate-500 block">الصفحات المعتمدة</span>
              <span className="text-2xl font-black text-[#284d57] mt-0.5 block">
                {rankSummary.totalApprovedPages.toLocaleString('ar-SA')}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold">موثقة رسمياً</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] text-center">
              <span className="text-[11px] font-bold text-slate-500 block">الكتب المكتملة</span>
              <span className="text-2xl font-black text-[#3b707d] mt-0.5 block">
                {rankSummary.completedBooksCount}
              </span>
              <span className="text-[10px] text-slate-500">كتاب مقروء</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] text-center">
              <span className="text-[11px] font-bold text-slate-500 block">نقاط المناقشات</span>
              <span className="text-2xl font-black text-amber-600 mt-0.5 block">
                {rankSummary.discussionPoints || 0}
              </span>
              <span className="text-[10px] text-amber-700 font-bold">نقاط تميز</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] text-center">
              <span className="text-[11px] font-bold text-slate-500 block">المستوى الحالي</span>
              <span className="text-sm font-black text-purple-700 mt-2 block truncate">
                {rankSummary.currentRank?.title || 'قيد البداية'}
              </span>
            </div>
          </div>

          {/* شريط التقدم نحو المستوى التالي */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#f8fbfb] to-[#eef5f7] border border-[#d5e6ec] space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5 text-[#1c353d]">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>التقدم نحو المستوى التالي:</span>
                <strong className="text-[#3b707d]">
                  {rankSummary.nextRank ? rankSummary.nextRank.title : 'أعلى المستويات (وثّاب)'}
                </strong>
              </span>
              <span className="font-mono text-[#3b707d]">{rankSummary.progressPercentToNext}%</span>
            </div>

            <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-slate-200 p-0.5">
              <div
                className="h-full bg-gradient-to-l from-[#3b707d] to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, rankSummary.progressPercentToNext))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
              <span>رصيد الطالب: {rankSummary.totalApprovedPages} صفحة</span>
              {rankSummary.nextRank ? (
                <span>
                  متبقي <strong className="text-amber-700 font-black">{rankSummary.remainingPagesToNext}</strong> صفحة لبلوغ {rankSummary.nextRank.title} ({rankSummary.nextRank.requiredPages} ص)
                </span>
              ) : (
                <span className="text-purple-700 font-black">أتم الطالب جميع المستويات المقررة بنجاح 🏆</span>
              )}
            </div>
          </div>

          {/* مسار الألقاب القرائية الخمسة */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#3b707d]" />
                <span>مسار المستويات والألقاب القرائية</span>
              </h4>
              <span className="text-[11px] text-slate-400">سُلّم التنافس المعتمد في مداد</span>
            </div>

            <div className="space-y-2">
              {activeRanksSorted.map((rank) => {
                const isEarned = rankSummary.totalApprovedPages >= rank.requiredPages;
                const isCurrent = rankSummary.currentRank?.id === rank.id;
                const isNext = rankSummary.nextRank?.id === rank.id;

                return (
                  <div
                    key={rank.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isEarned
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : isNext
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <RankEmblem
                          themeKey={rank.themeKey}
                          size="sm"
                          isHighest={rank.isHighestTier}
                          className={isEarned ? '' : 'grayscale opacity-60'}
                        />
                      </div>
                      <div>
                        <div className="font-black flex items-center gap-2">
                          <span>{rank.title}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                              المستوى الحالي
                            </span>
                          )}
                          {isNext && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                              الهدف القادم
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] block mt-0.5 opacity-80">
                          {rank.subtitle} • {rank.requiredPages} صفحة معتمدة
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isEarned ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-black text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>مكتمل</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 text-xs font-bold">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{rank.requiredPages} ص</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* قائمة الشهادات المحققة */}
          {studentCertificates.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                <span>الشهادات القرائية الصادرة للطالب ({studentCertificates.length})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {studentCertificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{cert.rankTitleSnapshot}</div>
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {cert.certificateNumber} • {formatArabicDate(cert.issuedAt)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                      معتمدة
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تنويه الخصوصية والأمان المعتمد */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              لوحة الإنجازات منصة تنافسية عامة تُبرز التميز القرائي دون عرض أي بيانات شخصية خاصة أو رموز دخول أو أرقام تواصل.
            </span>
          </div>
        </div>

        {/* ذيل النافذة */}
        <div className="p-4 bg-[#f6f8fa] border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
