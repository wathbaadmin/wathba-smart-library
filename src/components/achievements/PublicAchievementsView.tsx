import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { LeaderboardPeriod } from '../../types';
import {
  computeLeaderboard,
  LeaderboardStudentEntry,
} from '../../lib/achievementService';
import { StudentAchievementProfileModal } from './StudentAchievementProfileModal';
import { AchievementsSettingsModal } from './AchievementsSettingsModal';
import { RankEmblem } from '../student/ranks/RankEmblem';
import { Button } from '../common/Button';
import {
  Trophy,
  Crown,
  Medal,
  Award,
  BookOpen,
  Users,
  Calendar,
  Sparkles,
  Sliders,
  Search,
  Filter,
  CheckCircle2,
  ChevronLeft,
  Flame,
  GraduationCap,
  Eye,
  Info,
  Clock,
  ArrowUpDown,
  BookCheck,
  ShieldCheck,
} from 'lucide-react';

export interface PublicAchievementsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export const PublicAchievementsView: React.FC<PublicAchievementsViewProps> = ({
  onNavigateTab,
}) => {
  const { authMode, currentStaff, currentStudent } = useAuth();
  const {
    students,
    readingLogs,
    books,
    readingCompletions,
    discussions,
    readingRanks,
    achievementSettings,
    updateAchievementSettings,
    staff,
    studentRanks,
    readingCertificates,
    getStudentRankSummary,
  } = useLibrary();

  const isStaff = authMode === 'admin' || authMode === 'supervisor';
  const isAdmin = authMode === 'admin' || (currentStaff && currentStaff.role === 'admin');

  // إعدادات الفرز والتصفية
  const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>(
    achievementSettings?.defaultPeriod || 'all_time'
  );
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'leaderboard' | 'levels_guide'>(
    'leaderboard'
  );

  // مودالات
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] =
    useState<LeaderboardStudentEntry | null>(null);

  // حساب الترتيب والإحصائيات بدقة من السجلات المعتمدة
  const { entries, podium, stats, groupsList, supervisorsList } = useMemo(() => {
    return computeLeaderboard({
      students,
      readingLogs,
      books,
      readingCompletions,
      discussions,
      readingRanks,
      achievementSettings,
      staff,
      filters: {
        period: selectedPeriod,
        groupName: selectedGroup,
        supervisorId: selectedSupervisor,
        searchQuery,
      },
    });
  }, [
    students,
    readingLogs,
    books,
    readingCompletions,
    discussions,
    readingRanks,
    achievementSettings,
    staff,
    selectedPeriod,
    selectedGroup,
    selectedSupervisor,
    searchQuery,
  ]);

  // التحقق من صلاحية العرض للطلاب
  if (!achievementSettings.isEnabled && !isStaff) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800">
          لوحة الشرف والتنافس القرائي قيد التحديث
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          تقوم إدارة مكتبة مداد بمراجعة واعتماد إنجازات الطلاب الدورية. سيتم فتح اللوحة قريباً للجميع!
        </p>
      </div>
    );
  }

  const periodLabels: Record<LeaderboardPeriod, { label: string; icon: string }> = {
    today: { label: 'ترتيب اليوم', icon: '☀️' },
    week: { label: 'ترتيب الأسبوع', icon: '📅' },
    month: { label: 'ترتيب الشهر', icon: '🗓️' },
    all_time: { label: 'الترتيب الإجمالي', icon: '🏆' },
  };

  const activeRanksSorted = [...(readingRanks || [])]
    .filter((r) => r.isActive)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.requiredPages - b.requiredPages);

  return (
    <div className="space-y-6 sm:space-y-8 font-arabic" dir="rtl">
      {/* 1. الترويسة الرئيسية الفخمة مع هوية مداد */}
      <div className="relative rounded-3xl bg-gradient-to-l from-[#1c353d] via-[#284d57] to-[#3b707d] p-6 sm:p-8 text-white shadow-xl overflow-hidden">
        {/* خلفية زخرفية ناعمة */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>مكتبة مداد • التنافس القرائي المعتمد</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[11px] font-bold">
                تحديث لحظي
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
              <span>لوحة الشرف والتنافس القرائي</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
              منصة تكريم قرّاء مكتبة مداد المتميزين، واحتساب الصفحات المعتمدة والكتب المقروءة وسلّم الألقاب الخمسة لخلق بيئة قرائية ملهمة ومحفزة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isStaff && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsSettingsOpen(true)}
                icon={<Sliders className="w-4 h-4 text-amber-300" />}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold"
              >
                إعدادات اللوحة
              </Button>
            )}

            {currentStudent && onNavigateTab && (
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigateTab('ranks_certificates')}
                icon={<Award className="w-4 h-4" />}
                className="bg-amber-400 hover:bg-amber-500 text-slate-900 border-none font-black shadow-lg"
              >
                ألقابي وشهاداتي
              </Button>
            )}
          </div>
        </div>

        {/* بطاقات الإحصائيات العامة الخمسة المطلوبة */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6 mt-6 border-t border-white/15 text-slate-900">
          <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-white/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-bold">الصفحات المعتمدة</span>
              <BookOpen className="w-4 h-4 text-[#3b707d]" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-[#1c353d]">
                {stats.totalApprovedPages.toLocaleString('ar-SA')}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                صفحة موثقة رسمياً
              </span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-white/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-bold">الكتب المكتملة</span>
              <BookCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-[#284d57]">
                {stats.totalCompletedBooks.toLocaleString('ar-SA')}
              </span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                كتاب أتم قراءته
              </span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-white/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-bold">الطلاب المتنافسون</span>
              <Users className="w-4 h-4 text-sky-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-sky-900">
                {stats.participatingStudentsCount}
              </span>
              <span className="text-[10px] text-sky-700 font-bold block mt-0.5">
                قارئ نشط بالفترة
              </span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-white/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-bold">أبطال المستويات</span>
              <GraduationCap className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-purple-900">
                {stats.studentsWithLevelsCount}
              </span>
              <span className="text-[10px] text-purple-700 font-bold block mt-0.5">
                حملة الدبلوم فما فوق
              </span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-white/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs">
              <span className="font-bold">إجمالي الإنجازات</span>
              <Award className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-700">
                {stats.totalAchievementsEarned}
              </span>
              <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
                مستوى وشهادة محققة
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. شريط التبويبات الفترية وأزرار التبديل */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* أزرار الفترات الزمنية الأربعة */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {(['all_time', 'month', 'week', 'today'] as LeaderboardPeriod[]).map((p) => {
            const isSelected = selectedPeriod === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-[#284d57] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <span>{periodLabels[p].icon}</span>
                <span>{periodLabels[p].label}</span>
              </button>
            );
          })}
        </div>

        {/* التبديل بين لوحة المتصدرين ودليل المستويات */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('leaderboard')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
              activeSubTab === 'leaderboard'
                ? 'bg-white text-[#284d57] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>لوحة المتصدرين</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('levels_guide')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
              activeSubTab === 'levels_guide'
                ? 'bg-white text-[#284d57] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>دليل المستويات القرائية</span>
          </button>
        </div>
      </div>

      {/* 3. محتوى دليل المستويات القرائية الخمسة */}
      {activeSubTab === 'levels_guide' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-soft space-y-2">
            <h2 className="text-lg font-black text-[#1c353d] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#3b707d]" />
              <span>نظام المستويات والألقاب القرائية في مكتبة مداد</span>
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              يتدرج الطالب عبر خمسة مستويات معرفية معتمدة وفق إجمالي عدد الصفحات المقروءة والموثقة من المشرف، ويحصل عند كل استحقاق على وسام رقمي وشهادة تقدير رسمية.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRanksSorted.map((rank, idx) => (
              <div
                key={rank.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-2"
                  style={{ backgroundColor: rank.primaryColor }}
                />

                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: rank.secondaryColor }}>
                      <RankEmblem themeKey={rank.themeKey} size="md" isHighest={rank.isHighestTier} />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">
                      المستوى #{idx + 1}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-base text-slate-900">{rank.title}</h3>
                    <span className="text-xs font-bold text-slate-500 block mt-0.5">
                      {rank.subtitle}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {rank.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-500">الشرط المعتمد:</span>
                  <span className="font-black text-sm px-2.5 py-1 rounded-xl bg-slate-100 text-[#1c353d]">
                    {rank.requiredPages} صفحة
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. محتوى لوحة المتصدرين والتنافس */}
      {activeSubTab === 'leaderboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* شريط أدوات التصفية المتقدمة */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* البحث بالاسم أو الرقم */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث بالاسم أو المجموعة..."
                className="w-full min-h-[42px] pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-[#3b707d] outline-none"
              />
            </div>

            {/* تصفية المجموعة */}
            <div>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
              >
                <option value="all">جميع المجموعات ({groupsList.length})</option>
                {groupsList.map((g) => (
                  <option key={g} value={g}>
                    مجموعة: {g}
                  </option>
                ))}
              </select>
            </div>

            {/* تصفية المشرف */}
            <div>
              <select
                value={selectedSupervisor}
                onChange={(e) => setSelectedSupervisor(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
              >
                <option value="all">جميع المشرفين</option>
                {supervisorsList.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    المشرف: {sup.name}
                  </option>
                ))}
              </select>
            </div>

            {/* زر تفريغ الفلاتر */}
            {(selectedGroup !== 'all' || selectedSupervisor !== 'all' || searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedGroup('all');
                  setSelectedSupervisor('all');
                  setSearchQuery('');
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors text-xs"
              >
                إعادة ضبط التصفية
              </button>
            )}
          </div>

          {/* 5. منصة التتويج للمراكز الثلاثة الأولى (Podium) */}
          {achievementSettings.showPodium && podium.length > 0 && (
            <div className="bg-gradient-to-b from-[#f9fbfc] to-[#edf4f7] rounded-3xl border border-[#d2e4ea] p-5 sm:p-8 space-y-6 shadow-xs">
              <div className="text-center space-y-1">
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black border border-amber-200 inline-flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  <span>منصة الشرف والتتويج • المراكز الثلاثة الأولى</span>
                </span>
                <h2 className="text-lg sm:text-xl font-black text-[#1c353d]">
                  فرسان القراءة المتصدرون ({periodLabels[selectedPeriod].label})
                </h2>
              </div>

              {/* المنصة بتوزيع ثلاثي أنيق: المركز 2 يمين، المركز 1 بالوسط، المركز 3 يسار */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end max-w-3xl mx-auto pt-4">
                {/* المركز الثاني (فضة) */}
                {podium[1] ? (
                  <div
                    onClick={() => achievementSettings.allowStudentDetailModal && setSelectedStudentForModal(podium[1])}
                    className="order-2 sm:order-1 bg-white rounded-3xl border-2 border-slate-300 p-4 text-center space-y-3 shadow-md hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-400" />
                    <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-600 to-slate-400 border-2 border-white shadow-md flex items-center justify-center text-white text-xl font-black">
                      {podium[1].initials}
                      <span className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-slate-200 border border-slate-400 text-slate-800 font-black text-xs flex items-center justify-center">
                        2
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-sm text-slate-900 truncate">
                        {podium[1].displayName}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
                        {podium[1].student.grade} • {podium[1].student.groupName}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                      <span className="text-xl font-black text-[#1c353d] block">
                        {podium[1].periodPages.toLocaleString('ar-SA')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">صفحة معتمدة بالفترة</span>
                    </div>

                    <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
                      {podium[1].currentRank?.title || 'قارئ مبتدئ'}
                    </span>
                  </div>
                ) : (
                  <div className="order-2 sm:order-1" />
                )}

                {/* المركز الأول (ذهب) */}
                {podium[0] && (
                  <div
                    onClick={() => achievementSettings.allowStudentDetailModal && setSelectedStudentForModal(podium[0])}
                    className="order-1 sm:order-2 bg-gradient-to-b from-amber-50/90 to-white rounded-3xl border-2 border-amber-400 p-5 text-center space-y-3.5 shadow-xl hover:-translate-y-1.5 transition-all cursor-pointer relative overflow-hidden sm:-mt-6"
                  >
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 to-yellow-300" />

                    <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 border-4 border-white shadow-xl flex items-center justify-center text-white text-2xl font-black">
                      {podium[0].initials}
                      <Crown className="w-6 h-6 text-yellow-300 absolute -top-4 -right-1 drop-shadow-md animate-bounce" />
                      <span className="absolute -bottom-2 -left-2 w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                        1
                      </span>
                    </div>

                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black inline-block mb-1">
                        بطل القراءة المتصدر 🏆
                      </span>
                      <h3 className="font-black text-base text-slate-900 truncate">
                        {podium[0].displayName}
                      </h3>
                      <span className="text-xs text-slate-500 font-bold block mt-0.5">
                        {podium[0].student.grade} • {podium[0].student.groupName}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-0.5">
                      <span className="text-2xl font-black text-amber-900 block">
                        {podium[0].periodPages.toLocaleString('ar-SA')}
                      </span>
                      <span className="text-[11px] text-amber-700 font-bold">صفحة معتمدة بالفترة</span>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#284d57]">
                      {podium[0].currentRank && (
                        <RankEmblem themeKey={podium[0].currentRank.themeKey} size="sm" />
                      )}
                      <span>{podium[0].currentRank?.title || 'قارئ متميز'}</span>
                    </div>
                  </div>
                )}

                {/* المركز الثالث (برونز) */}
                {podium[2] ? (
                  <div
                    onClick={() => achievementSettings.allowStudentDetailModal && setSelectedStudentForModal(podium[2])}
                    className="order-3 bg-white rounded-3xl border-2 border-amber-600/40 p-4 text-center space-y-3 shadow-md hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-700" />
                    <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-800 to-amber-600 border-2 border-white shadow-md flex items-center justify-center text-white text-xl font-black">
                      {podium[2].initials}
                      <span className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-amber-100 border border-amber-600 text-amber-900 font-black text-xs flex items-center justify-center">
                        3
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-sm text-slate-900 truncate">
                        {podium[2].displayName}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-bold block mt-0.5">
                        {podium[2].student.grade} • {podium[2].student.groupName}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                      <span className="text-xl font-black text-[#1c353d] block">
                        {podium[2].periodPages.toLocaleString('ar-SA')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">صفحة معتمدة بالفترة</span>
                    </div>

                    <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px]">
                      {podium[2].currentRank?.title || 'قارئ مبتدئ'}
                    </span>
                  </div>
                ) : (
                  <div className="order-3" />
                )}
              </div>
            </div>
          )}

          {/* 6. قائمة جدول الترتيب التنافسي الشامل */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#3b707d]" />
                  <span>ترتيب الطلاب التنافسي الكامل ({entries.length} طالب)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  مرتبة تنازلياً حسب إجمالي الصفحات المعتمدة خلال الفترة المحددة ({periodLabels[selectedPeriod].label})
                </p>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>جميع الأرقام مستخرجة من سجلات القراءة المعتمدة</span>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">لا توجد سجلات مطابقة لمعايير البحث الحالية</p>
                <p className="text-[11px] text-slate-400">جرّب اختيار فترة زمنية أخرى أو إزالة الفلاتر</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const isTop3 = entry.rankPosition <= 3;
                  const rankBadgeClass =
                    entry.rankPosition === 1
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : entry.rankPosition === 2
                      ? 'bg-slate-300 text-slate-900 font-black'
                      : entry.rankPosition === 3
                      ? 'bg-amber-700 text-white font-black'
                      : 'bg-slate-100 text-slate-700 font-bold';

                  return (
                    <div
                      key={entry.student.id}
                      onClick={() =>
                        achievementSettings.allowStudentDetailModal && setSelectedStudentForModal(entry)
                      }
                      className={`p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        achievementSettings.allowStudentDetailModal
                          ? 'hover:bg-slate-50/80 cursor-pointer'
                          : ''
                      } ${entry.student.id === currentStudent?.id ? 'bg-[#eef5f7]/60 border-r-4 border-[#3b707d]' : ''}`}
                    >
                      {/* معلومات الطالب والترتيب */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* شارة الترتيب */}
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 font-mono ${rankBadgeClass}`}
                        >
                          #{entry.rankPosition}
                        </div>

                        {/* أفاتار الطالب */}
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#284d57] to-[#3b707d] text-white flex items-center justify-center font-black text-sm shadow-xs">
                            {entry.initials}
                          </div>
                          {entry.currentRank && (
                            <div className="absolute -bottom-1 -left-1">
                              <RankEmblem themeKey={entry.currentRank.themeKey} size="xs" />
                            </div>
                          )}
                        </div>

                        {/* اسم الطالب والمجموعة */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                              {entry.displayName}
                            </span>
                            {entry.student.id === currentStudent?.id && (
                              <span className="px-2 py-0.5 rounded-full bg-[#3b707d] text-white text-[10px] font-bold">
                                أنت
                              </span>
                            )}
                            {entry.isWathabAchieved && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200">
                                وثّاب ★
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {entry.student.grade} • {entry.student.groupName}
                          </span>
                        </div>
                      </div>

                      {/* شريط التقدم والأرقام */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* المستوى وشريط التقدم */}
                        <div className="w-32 sm:w-40 space-y-1 text-[11px] shrink-0">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                            <span className="text-[#284d57] font-black truncate max-w-[90px]">
                              {entry.currentRank?.title || 'قارئ مبتدئ'}
                            </span>
                            <span className="font-mono">{entry.progressPercentToNext}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-l from-[#3b707d] to-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(3, entry.progressPercentToNext))}%` }}
                            />
                          </div>
                        </div>

                        {/* الصفحات المقروءة والكتب */}
                        <div className="text-left shrink-0">
                          <div className="text-sm sm:text-base font-black text-[#1c353d]">
                            {entry.periodPages.toLocaleString('ar-SA')}{' '}
                            <span className="text-xs font-normal text-slate-500">صفحة</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold block">
                            {entry.completedBooksCount} كتب مكتملة
                          </span>
                        </div>

                        {/* زر فتح التفاصيل */}
                        {achievementSettings.allowStudentDetailModal && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForModal(entry);
                            }}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-[#e3ecf3] text-[#284d57] text-xs font-bold transition-colors shrink-0"
                            title="عرض ملف الإنجازات"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. نافذة عرض ملف إنجازات الطالب القرائية (Modal) */}
      {selectedStudentForModal && (
        <StudentAchievementProfileModal
          isOpen={Boolean(selectedStudentForModal)}
          onClose={() => setSelectedStudentForModal(null)}
          student={selectedStudentForModal.student}
          displayName={selectedStudentForModal.displayName}
          rankSummary={getStudentRankSummary(selectedStudentForModal.student.id)}
          readingRanks={readingRanks}
          studentAchievements={studentRanks.filter(
            (sr) => sr.studentId === selectedStudentForModal.student.id && sr.status === 'active'
          )}
          studentCertificates={readingCertificates.filter(
            (c) => c.studentId === selectedStudentForModal.student.id
          )}
          achievementSettings={achievementSettings}
        />
      )}

      {/* 8. نافذة إعدادات الإدارة (Modal) */}
      {isStaff && (
        <AchievementsSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={achievementSettings}
          students={students}
          onSave={(updates) => {
            updateAchievementSettings(updates);
          }}
        />
      )}
    </div>
  );
};
