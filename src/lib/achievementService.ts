import {
  Student,
  ReadingLog,
  Book,
  BookReadingCompletion,
  ReadingDiscussion,
  ReadingRankDefinition,
  AchievementSettings,
  LeaderboardPeriod,
  NameDisplayMode,
  StaffUser,
} from '../types';

export interface LeaderboardStudentEntry {
  rankPosition: number;
  isTied: boolean;
  student: Student;
  displayName: string;
  initials: string;
  avatarSeedColor: string;
  periodPages: number;
  totalAllTimePages: number;
  completedBooksCount: number;
  currentRank: ReadingRankDefinition | null;
  nextRank: ReadingRankDefinition | null;
  progressPercentToNext: number;
  remainingPagesToNext: number;
  isWathabAchieved: boolean;
  isExcluded: boolean;
}

export interface AchievementGeneralStats {
  totalApprovedPages: number;
  totalCompletedBooks: number;
  participatingStudentsCount: number;
  studentsWithLevelsCount: number;
  totalAchievementsEarned: number;
}

/**
 * تنسيق اسم الطالب وفق إعدادات الخصوصية المختارة من الإدارة
 */
export const formatStudentDisplayName = (
  fullName: string,
  internalId: string,
  mode: NameDisplayMode
): string => {
  const cleanName = (fullName || '').trim();
  if (!cleanName) return 'طالب مداد';

  switch (mode) {
    case 'first_name_only': {
      const parts = cleanName.split(/\s+/);
      return parts[0] || cleanName;
    }
    case 'first_and_family': {
      const parts = cleanName.split(/\s+/);
      if (parts.length <= 2) return cleanName;
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
    case 'pseudonym': {
      const numericDigits = internalId.replace(/\D/g, '');
      const codeSnippet = numericDigits ? numericDigits.slice(-3) : internalId.slice(-3);
      return `فارس القراءة #${codeSnippet || '★'}`;
    }
    case 'full_name':
    default:
      return cleanName;
  }
};

/**
 * استخراج الأحرف الأولى من اسم الطالب لرمز الأفاتار الأنيق
 */
export const getStudentInitials = (name: string): string => {
  const clean = (name || '').trim();
  if (!clean) return 'م';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`;
};

/**
 * تحديد لون أفاتار مشتق من معرف الطالب بتناغم مع ألوان مداد
 */
export const getStudentAvatarGradient = (id: string): { from: string; to: string; text: string } => {
  const gradients = [
    { from: 'from-[#284d57]', to: 'to-[#3b707d]', text: 'text-white' },
    { from: 'from-[#3b707d]', to: 'to-[#0284c7]', text: 'text-white' },
    { from: 'from-[#0f766e]', to: 'to-[#10b981]', text: 'text-white' },
    { from: 'from-[#6366f1]', to: 'to-[#8b5cf6]', text: 'text-white' },
    { from: 'from-[#b45309]', to: 'to-[#d97706]', text: 'text-white' },
    { from: 'from-[#be185d]', to: 'to-[#f43f5e]', text: 'text-white' },
    { from: 'from-[#1e293b]', to: 'to-[#475569]', text: 'text-white' },
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

/**
 * فحص ما إذا كان تاريخ القراءة واقعاً ضمن الفترة الزمنية المحددة (بتوقيت المملكة)
 */
export const isLogDateInPeriod = (dateStr: string, period: LeaderboardPeriod): boolean => {
  if (period === 'all_time') return true;
  if (!dateStr) return false;

  const logDate = new Date(dateStr);
  if (isNaN(logDate.getTime())) return false;

  const now = new Date();

  // فحص تاريخ اليوم (YYYY-MM-DD)
  const toDateStringOnly = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const logDayStr = dateStr.slice(0, 10);
  const todayStr = toDateStringOnly(now);

  if (period === 'today') {
    return logDayStr === todayStr;
  }

  if (period === 'week') {
    // الأسبوع الحالي: آخر 7 أيام أو من بداية أسبوع السبت/الأحد
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return logDate >= sevenDaysAgo && logDate <= now;
  }

  if (period === 'month') {
    return (
      logDate.getFullYear() === now.getFullYear() &&
      logDate.getMonth() === now.getMonth()
    );
  }

  return true;
};

export interface LeaderboardComputeParams {
  students: Student[];
  readingLogs: ReadingLog[];
  books: Book[];
  readingCompletions: BookReadingCompletion[];
  discussions: ReadingDiscussion[];
  readingRanks: ReadingRankDefinition[];
  achievementSettings: AchievementSettings;
  staff: StaffUser[];
  filters: {
    period: LeaderboardPeriod;
    groupName?: string;
    supervisorId?: string;
    searchQuery?: string;
  };
}

/**
 * حساب لوحة المتصدرين بدقة كاملة ومطابقة لقواعد الاعتماد
 */
export const computeLeaderboard = ({
  students,
  readingLogs,
  books,
  readingCompletions,
  discussions,
  readingRanks,
  achievementSettings,
  staff,
  filters,
}: LeaderboardComputeParams): {
  entries: LeaderboardStudentEntry[];
  podium: LeaderboardStudentEntry[];
  stats: AchievementGeneralStats;
  groupsList: string[];
  supervisorsList: { id: string; name: string }[];
} => {
  const activeRanks = [...(readingRanks || [])]
    .filter((r) => r.isActive)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.requiredPages - b.requiredPages);

  const highestTier = activeRanks.find((r) => r.isHighestTier);
  const minPages = achievementSettings?.minPagesToAppear ?? 1;
  const excludedSet = new Set(achievementSettings?.excludedStudentIds || []);

  // 1. استخراج المجموعات والمشرفين لقوائم التصفية
  const groupsList = Array.from(
    new Set(students.map((s) => s.groupName).filter(Boolean))
  ).sort();

  const supervisorsList = staff
    .filter((s) => s.status === 'active')
    .map((s) => ({ id: s.id, name: s.fullName }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  // 2. تصفية السجلات المعتمدة فقط وفق الفترة المختارة
  const approvedLogs = (readingLogs || []).filter((l) => l.status === 'approved');

  // جمع الكتب المعتمدة عبر طلبات الإكمال أو المناقشات لضمان التوثيق الشامل
  const autoApprovedBookIdsByStudent = new Map<string, Set<string>>();
  (readingCompletions || [])
    .filter((c) => c.status === 'approved')
    .forEach((c) => {
      if (!autoApprovedBookIdsByStudent.has(c.studentId)) {
        autoApprovedBookIdsByStudent.set(c.studentId, new Set());
      }
      autoApprovedBookIdsByStudent.get(c.studentId)!.add(c.bookId);
    });
  (discussions || [])
    .filter((d) => d.status === 'approved')
    .forEach((d) => {
      if (!autoApprovedBookIdsByStudent.has(d.studentId)) {
        autoApprovedBookIdsByStudent.set(d.studentId, new Set());
      }
      autoApprovedBookIdsByStudent.get(d.studentId)!.add(d.bookId);
    });

  // خريطة صفحات كل طالب خلال الفترة المحددة
  const periodPagesByStudent = new Map<string, number>();
  // خريطة صفحات كل طالب الإجمالية (All-Time) لحساب المستوى بدقة
  const allTimePagesByStudent = new Map<string, number>();
  // خريطة الكتب المقروءة لكل طالب
  const completedBooksByStudent = new Map<string, number>();

  students.forEach((s) => {
    const studentLogs = approvedLogs.filter((l) => l.studentId === s.id);

    // حساب صفحات الفترة
    const inPeriodLogs = studentLogs.filter((l) =>
      isLogDateInPeriod(l.readingDate || l.createdAt, filters.period)
    );
    const pSum = inPeriodLogs.reduce(
      (sum, l) => sum + (l.correctedPagesCount ?? l.pagesCount),
      0
    );

    // حساب الصفحات الإجمالية مع دمج الكتب المعتمدة
    const pagesByBook = new Map<string, number>();
    studentLogs.forEach((l) => {
      pagesByBook.set(
        l.bookId,
        (pagesByBook.get(l.bookId) || 0) + (l.correctedPagesCount ?? l.pagesCount)
      );
    });

    const autoBooks = autoApprovedBookIdsByStudent.get(s.id);
    if (autoBooks) {
      autoBooks.forEach((bId) => {
        const b = books.find((bk) => bk.id === bId);
        const targetPages = b?.pageCount && b.pageCount > 0 ? b.pageCount : 100;
        const current = pagesByBook.get(bId) || 0;
        if (current < targetPages) {
          pagesByBook.set(bId, targetPages);
        }
      });
    }

    let allTimeTotal = 0;
    pagesByBook.forEach((val) => {
      allTimeTotal += val;
    });

    let completedCount = 0;
    pagesByBook.forEach((val, bId) => {
      const b = books.find((bk) => bk.id === bId);
      const targetPages = b?.pageCount && b.pageCount > 0 ? b.pageCount : 100;
      if (val >= targetPages) {
        completedCount += 1;
      }
    });

    // إذا كانت الفترة هي all_time، فإن صفحات الفترة هي نفسها الصفحات الإجمالية
    const finalPeriodPages = filters.period === 'all_time' ? allTimeTotal : pSum;

    periodPagesByStudent.set(s.id, finalPeriodPages);
    allTimePagesByStudent.set(s.id, allTimeTotal);
    completedBooksByStudent.set(s.id, Math.max(completedCount, s.totalBooksRead || 0));
  });

  // 3. بناء العناصر لكل طالب مع تصفية البحث والمجموعات والمشرف
  const allEntries: LeaderboardStudentEntry[] = [];

  students.forEach((stu) => {
    const isExcluded = excludedSet.has(stu.id);
    if (achievementSettings.excludeInactiveStudents && isExcluded) return;

    // تصفية المجموعة
    if (filters.groupName && filters.groupName !== 'all' && stu.groupName !== filters.groupName) {
      return;
    }

    // تصفية المشرف
    if (filters.supervisorId && filters.supervisorId !== 'all') {
      const sup = staff.find((st) => st.id === filters.supervisorId);
      if (sup && sup.assignedGroups && sup.assignedGroups.length > 0) {
        if (!sup.assignedGroups.includes(stu.groupName)) {
          return;
        }
      }
    }

    // تصفية البحث بالاسم أو الكود
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      const matchName = stu.fullName.toLowerCase().includes(q);
      const matchGroup = (stu.groupName || '').toLowerCase().includes(q);
      const matchCode = (stu.internalId || '').toLowerCase().includes(q);
      if (!matchName && !matchGroup && !matchCode) {
        return;
      }
    }

    const pPages = periodPagesByStudent.get(stu.id) || 0;
    const aPages = allTimePagesByStudent.get(stu.id) || 0;
    const cBooks = completedBooksByStudent.get(stu.id) || 0;

    // استبعاد الطلاب دون صفحات إذا كان مفعل في الإعدادات
    if (achievementSettings.excludeInactiveStudents && pPages < minPages && aPages < minPages) {
      return;
    }

    // حساب المستوى الحالي والمستوى التالي
    let currentRank: ReadingRankDefinition | null = null;
    let nextRank: ReadingRankDefinition | null = null;

    activeRanks.forEach((r) => {
      if (aPages >= r.requiredPages) {
        currentRank = r;
      } else if (!nextRank) {
        nextRank = r;
      }
    });

    const isWathabAchieved = !!(highestTier && aPages >= highestTier.requiredPages);

    const prevRequired = currentRank ? (currentRank as ReadingRankDefinition).requiredPages : 0;
    const nextRequired = nextRank ? (nextRank as ReadingRankDefinition).requiredPages : prevRequired;
    const remainingPagesToNext = nextRank ? Math.max(0, nextRequired - aPages) : 0;

    let progressPercentToNext = 100;
    if (nextRank) {
      const span = Math.max(1, nextRequired - prevRequired);
      const done = Math.max(0, aPages - prevRequired);
      progressPercentToNext = Math.min(100, Math.max(0, Math.round((done / span) * 100)));
    }

    const displayName = formatStudentDisplayName(
      stu.fullName,
      stu.internalId,
      achievementSettings.nameDisplayMode
    );
    const initials = getStudentInitials(stu.fullName);

    allEntries.push({
      rankPosition: 0,
      isTied: false,
      student: stu,
      displayName,
      initials,
      avatarSeedColor: stu.id,
      periodPages: pPages,
      totalAllTimePages: aPages,
      completedBooksCount: cBooks,
      currentRank,
      nextRank,
      progressPercentToNext,
      remainingPagesToNext,
      isWathabAchieved,
      isExcluded,
    });
  });

  // 4. الترتيب التنافسي للطلاب:
  // أولاً: صفحات الفترة المحددة تنازلياً
  // ثانياً: إجمالي الصفحات المقروءة تنازلياً
  // ثالثاً: عدد الكتب المكتملة تنازلياً
  allEntries.sort((a, b) => {
    if (b.periodPages !== a.periodPages) {
      return b.periodPages - a.periodPages;
    }
    if (b.totalAllTimePages !== a.totalAllTimePages) {
      return b.totalAllTimePages - a.totalAllTimePages;
    }
    if (b.completedBooksCount !== a.completedBooksCount) {
      return b.completedBooksCount - a.completedBooksCount;
    }
    return a.displayName.localeCompare(b.displayName, 'ar');
  });

  // حساب المراكز مع احتساب التعادل (Tied Ranks)
  let currentPos = 1;
  for (let i = 0; i < allEntries.length; i++) {
    if (
      i > 0 &&
      allEntries[i].periodPages === allEntries[i - 1].periodPages &&
      allEntries[i].totalAllTimePages === allEntries[i - 1].totalAllTimePages
    ) {
      allEntries[i].rankPosition = allEntries[i - 1].rankPosition;
      allEntries[i].isTied = true;
      allEntries[i - 1].isTied = true;
    } else {
      allEntries[i].rankPosition = currentPos;
      allEntries[i].isTied = false;
    }
    currentPos++;
  }

  // 5. استخراج المراكز الثلاثة الأولى لمنصة التتويج
  const podium = allEntries.slice(0, 3);

  // 6. حساب الإحصائيات العامة
  let totalApprovedPages = 0;
  let totalCompletedBooks = 0;
  let participatingStudentsCount = 0;
  let studentsWithLevelsCount = 0;
  let totalAchievementsEarned = 0;

  allEntries.forEach((entry) => {
    totalApprovedPages += entry.periodPages;
    totalCompletedBooks += entry.completedBooksCount;
    if (entry.periodPages > 0) {
      participatingStudentsCount += 1;
    }
    if (entry.currentRank) {
      studentsWithLevelsCount += 1;
    }
  });

  // عدد الإنجازات المحققة (المستويات المكتسبة)
  activeRanks.forEach((rank) => {
    const earnedCount = allEntries.filter((e) => e.totalAllTimePages >= rank.requiredPages).length;
    totalAchievementsEarned += earnedCount;
  });

  return {
    entries: allEntries,
    podium,
    stats: {
      totalApprovedPages,
      totalCompletedBooks,
      participatingStudentsCount,
      studentsWithLevelsCount,
      totalAchievementsEarned,
    },
    groupsList,
    supervisorsList,
  };
};
