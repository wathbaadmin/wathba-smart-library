import React from 'react';
import { ReadingChallenge, Student } from '../../types';
import { Trophy, Award, Sparkles, BookOpen } from 'lucide-react';

interface ReadingChallengeCardProps {
  student: Student;
  challenge: ReadingChallenge;
}

export const ReadingChallengeCard: React.FC<ReadingChallengeCardProps> = ({ student, challenge }) => {
  const readCount = student.totalBooksRead || 0;
  const target = challenge.targetBooks || 5;
  const percentage = Math.min(100, Math.round((readCount / target) * 100));

  let badgeTitle = 'مستكشف وثبة 🥉';
  let badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
  if (readCount >= target) {
    badgeTitle = 'القارئ الماسي لوثبة 💎';
    badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (readCount >= Math.ceil(target * 0.6)) {
    badgeTitle = 'القارئ الذهبي 🥇';
    badgeColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  } else if (readCount >= Math.ceil(target * 0.3)) {
    badgeTitle = 'القارئ الفضي 🥈';
    badgeColor = 'bg-slate-200 text-slate-800 border-slate-300';
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-wathba-800 to-emerald-950 p-6 text-white shadow-card">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-gold-400/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-right flex-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-700/60 text-emerald-200 text-xs font-bold border border-emerald-500/30">
            <Trophy className="w-3.5 h-3.5 text-gold-400" />
            <span>{challenge.title}</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white">
            رحلتك نحو وسام القراءة الشهري!
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed max-w-xl">
            {challenge.description}
          </p>

          {/* Progress Bar */}
          <div className="pt-3 max-w-md">
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <span>إنجازك: {readCount} من {target} كتب</span>
              <span className="text-gold-300">{percentage}%</span>
            </div>
            <div className="w-full h-3.5 bg-emerald-950/60 rounded-full p-0.5 border border-emerald-600/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-gold-400 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Badge & Achievement Display */}
        <div className="shrink-0 flex flex-col items-center justify-center p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center min-w-[170px]">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-gold-500 to-yellow-300 flex items-center justify-center text-slate-900 shadow-soft mb-2">
            <Award className="w-8 h-8" />
          </div>
          <span className="text-xs text-emerald-200 font-medium">وسامك الحالي:</span>
          <span className="text-sm font-black text-white mt-0.5">{badgeTitle}</span>
          <span className="text-[10px] text-emerald-300/80 mt-1">
            {readCount >= target ? 'أحسنت! حققت التحدي 🎉' : `بقي ${Math.max(0, target - readCount)} كتب للهدف`}
          </span>
        </div>
      </div>
    </div>
  );
};
