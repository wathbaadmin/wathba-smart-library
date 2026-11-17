import {
  CertificateSettings,
  ReadingCertificate,
  ReadingRankDefinition,
} from '../types';

export const initialCertificateSettings: CertificateSettings = {
  issuerOrganization: 'مكتبة وثبة الذكية • فريق وثبة',
  signatoryTitle: 'إدارة مكتبة وثبة الذكية',
  signatoryName: 'فريق الإشراف التربوي والثقافي',
  footerNote:
    'صادرة إلكترونياً وموثقة في السجل القرائي المركزي لمكتبة وثبة الذكية — المملكة العربية السعودية',
  serialPrefix: 'WTH-CERT',
  updatedAt: '2026-11-01T08:00:00Z',
};

export const initialReadingRanks: ReadingRankDefinition[] = [
  {
    id: 'rank-diploma',
    code: 'DIPLOMA',
    orderIndex: 1,
    title: 'دبلوم القراءة',
    subtitle: 'المرتبة الأكاديمية الأولى',
    requiredPages: 100,
    description:
      'بداية واثقة ومشرقة في عالم المعرفة، تُمنح عند إتمام قراءة واعتماد 100 صفحة من كتب المكتبة.',
    motivationalPhrase:
      'مبارك خطوتك الأولى في درب القرّاء المتميزين؛ كل صفحة تقرؤها تفتح لك باباً جديداً للنور والفهم!',
    themeKey: 'diploma',
    primaryColor: '#3b707d',
    secondaryColor: '#e3ecf3',
    accentColor: '#0284c7',
    badgeTitle: 'شارة باحث الدبلوم',
    certificateHeading: 'شهادة استحقاق الدرجة التأسيسية في القراءة',
    isHighestTier: false,
    isActive: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'rank-bachelor',
    code: 'BACHELOR',
    orderIndex: 2,
    title: 'بكالوريوس القراءة',
    subtitle: 'المرتبة الأكاديمية الثانية',
    requiredPages: 300,
    description:
      'إنجاز قرائي متين يعكس شغف الطالب بالاطلاع والمثابرة عبر 300 صفحة معتمدة.',
    motivationalPhrase:
      'أثبتَّ همّةً عاليةً وعزيمةً صادقةً في صحبة الكتاب، فهنيئاً لك هذا التقدّم المشرّف!',
    themeKey: 'bachelor',
    primaryColor: '#026bc9',
    secondaryColor: '#e0effe',
    accentColor: '#38bdf8',
    badgeTitle: 'شارة قارئ البكالوريوس',
    certificateHeading: 'شهادة تفوّق وإجادة في القراءة المعرفية',
    isHighestTier: false,
    isActive: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'rank-master',
    code: 'MASTER',
    orderIndex: 3,
    title: 'ماجستير القراءة',
    subtitle: 'المرتبة الأكاديمية الثالثة',
    requiredPages: 600,
    description:
      'مرتبة رفيعة لقارئ متمرّس أتم قراءة واعتماد 600 صفحة من روائع الفكر والقصص والعلوم.',
    motivationalPhrase:
      'لقد صنعت من القراءة عادةً راسخةً ترفع قدرك وتنير عقلك نحو آفاق التميّز والقيادة!',
    themeKey: 'master',
    primaryColor: '#059669',
    secondaryColor: '#d1fae5',
    accentColor: '#d97706',
    badgeTitle: 'وسام أستاذ الماجستير',
    certificateHeading: 'شهادة التميّز والريادة في القراءة المتقدمة',
    isHighestTier: false,
    isActive: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'rank-doctorate',
    code: 'DOCTORATE',
    orderIndex: 4,
    title: 'دكتوراه القراءة',
    subtitle: 'المرتبة الأكاديمية الرابعة',
    requiredPages: 1000,
    description:
      'مقام العلماء الصغار والباحثين النجباء الذين تجاوزوا حاجز الألف صفحة مقروءة ومعتمدة.',
    motivationalPhrase:
      'ألف صفحة من الفكر والمعرفة تشهد على نبوغك ومثابرتك، وأصبحتَ قدوةً لزملائك في مكتبة وثبة!',
    themeKey: 'doctorate',
    primaryColor: '#6d28d9',
    secondaryColor: '#ede9fe',
    accentColor: '#c084fc',
    badgeTitle: 'نوط دكتوراه المعرفة',
    certificateHeading: 'الشهادة العليا للإبحار المعرفي والقراءة المتعمقة',
    isHighestTier: false,
    isActive: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  },
  {
    id: 'rank-wathab',
    code: 'WATHAB',
    orderIndex: 5,
    title: 'وثّاب',
    subtitle: 'التصنيف الأعلى والأرفع في المكتبة',
    requiredPages: 1500,
    description:
      'الوسام القرائي الأعلى والأندر في مكتبة وثبة الذكية؛ يُمنح لمن أتم 1,500 صفحة مقروءة ومعتمدة بإتقان.',
    motivationalPhrase:
      'هنيئاً لك بلوغ القمّة وتتوّجك بلقب «وثّاب» الأعلى في المكتبة؛ ستظل منارةً للعلم والشغف والقدوة الحسنة!',
    themeKey: 'wathab',
    primaryColor: '#162b31',
    secondaryColor: '#fef9c3',
    accentColor: '#d4af37',
    badgeTitle: 'الوسام الذهبي الحصري «وثّاب»',
    certificateHeading: 'شهادة الشرف العظمى — التصنيف الأعلى «وثّاب»',
    isHighestTier: true,
    isActive: true,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  },
];

export const RANK_THEME_PRESETS: Record<
  ReadingRankDefinition['themeKey'],
  { label: string; primaryColor: string; secondaryColor: string; accentColor: string }
> = {
  diploma: {
    label: 'أكاديمي تركوازي (دبلوم)',
    primaryColor: '#3b707d',
    secondaryColor: '#e3ecf3',
    accentColor: '#0284c7',
  },
  bachelor: {
    label: 'ملكي سماوي (بكالوريوس)',
    primaryColor: '#026bc9',
    secondaryColor: '#e0effe',
    accentColor: '#38bdf8',
  },
  master: {
    label: 'زمردي فاخر (ماجستير)',
    primaryColor: '#059669',
    secondaryColor: '#d1fae5',
    accentColor: '#d97706',
  },
  doctorate: {
    label: 'أرجواني رفيع (دكتوراه)',
    primaryColor: '#6d28d9',
    secondaryColor: '#ede9fe',
    accentColor: '#c084fc',
  },
  wathab: {
    label: 'التاج الإمبراطوري الذهبي (وثّاب)',
    primaryColor: '#162b31',
    secondaryColor: '#fef9c3',
    accentColor: '#d4af37',
  },
  custom: {
    label: 'تخصيص حر للألوان',
    primaryColor: '#3b707d',
    secondaryColor: '#e3ecf3',
    accentColor: '#d4af37',
  },
};

export function generateUniqueCertificateNumber(
  prefix: string,
  existingCertificates: ReadingCertificate[]
): string {
  const year = new Date().getFullYear();
  const cleanPrefix = (prefix || 'WTH-CERT').trim().toUpperCase();
  let seq = existingCertificates.length + 1;
  let candidate = `${cleanPrefix}-${year}-${String(seq).padStart(4, '0')}`;
  const usedNumbers = new Set(existingCertificates.map((c) => c.certificateNumber));
  while (usedNumbers.has(candidate)) {
    seq += 1;
    candidate = `${cleanPrefix}-${year}-${String(seq).padStart(4, '0')}`;
  }
  return candidate;
}
