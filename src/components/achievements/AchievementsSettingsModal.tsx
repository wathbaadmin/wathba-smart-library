import React, { useState } from 'react';
import { AchievementSettings, LeaderboardPeriod, NameDisplayMode, Student } from '../../types';
import { Button } from '../common/Button';
import {
  X,
  Sliders,
  Eye,
  UserCheck,
  ShieldAlert,
  Clock,
  Sparkles,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Users,
} from 'lucide-react';

export interface AchievementsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AchievementSettings;
  students: Student[];
  onSave: (updates: Partial<AchievementSettings>) => void;
}

export const AchievementsSettingsModal: React.FC<AchievementsSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  students,
  onSave,
}) => {
  const [isEnabled, setIsEnabled] = useState(settings?.isEnabled ?? true);
  const [showLeaderboardToStudents, setShowLeaderboardToStudents] = useState(
    settings?.showLeaderboardToStudents ?? true
  );
  const [nameDisplayMode, setNameDisplayMode] = useState<NameDisplayMode>(
    settings?.nameDisplayMode || 'full_name'
  );
  const [showAvatars, setShowAvatars] = useState(settings?.showAvatars ?? true);
  const [defaultPeriod, setDefaultPeriod] = useState<LeaderboardPeriod>(
    settings?.defaultPeriod || 'all_time'
  );
  const [minPagesToAppear, setMinPagesToAppear] = useState<number>(
    settings?.minPagesToAppear ?? 1
  );
  const [excludeInactiveStudents, setExcludeInactiveStudents] = useState(
    settings?.excludeInactiveStudents ?? false
  );
  const [excludedStudentIds, setExcludedStudentIds] = useState<string[]>(
    settings?.excludedStudentIds || []
  );
  const [showPodium, setShowPodium] = useState(settings?.showPodium ?? true);
  const [showLevelsGuide, setShowLevelsGuide] = useState(settings?.showLevelsGuide ?? true);
  const [allowStudentDetailModal, setAllowStudentDetailModal] = useState(
    settings?.allowStudentDetailModal ?? true
  );

  const [studentSearch, setStudentSearch] = useState('');

  if (!isOpen) return null;

  const handleToggleExcludeStudent = (id: string) => {
    setExcludedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      isEnabled,
      showLeaderboardToStudents,
      nameDisplayMode,
      showAvatars,
      defaultPeriod,
      minPagesToAppear: Math.max(0, Number(minPagesToAppear) || 0),
      excludeInactiveStudents,
      excludedStudentIds,
      showPodium,
      showLevelsGuide,
      allowStudentDetailModal,
    });
    onClose();
  };

  const filteredStudents = students.filter(
    (s) =>
      !studentSearch.trim() ||
      s.fullName.toLowerCase().includes(studentSearch.trim().toLowerCase()) ||
      s.internalId.toLowerCase().includes(studentSearch.trim().toLowerCase()) ||
      (s.groupName || '').toLowerCase().includes(studentSearch.trim().toLowerCase())
  );

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
        {/* رأس النافذة */}
        <div className="p-5 sm:p-6 bg-gradient-to-l from-[#1c353d] to-[#284d57] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black">إعدادات لوحة الشرف والتنافس القرائي</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                التحكم في ظهور المنصة، خصوصية الأسماء، استبعاد الحسابات، والفترات المعتمدة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جسم الإعدادات */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* 1. تفعيل اللوحة والظهور العام */}
          <div className="p-4 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#3b707d]" />
              <span>إتاحة وظهور المنصة</span>
            </h4>

            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    تفعيل صفحة الإنجازات والتنافس القرائي
                  </span>
                  <span className="text-[11px] text-slate-500">
                    تشغيل النظام بالكامل في المنصة للمشرفين والطلاب
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-5 h-5 rounded text-[#3b707d] focus:ring-[#3b707d]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    إتاحة لوحة المتصدرين لحسابات الطلاب
                  </span>
                  <span className="text-[11px] text-slate-500">
                    السماح للطلاب بتصفح ترتيب زملائهم وتحفيز التنافس الإيجابي
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showLeaderboardToStudents}
                  onChange={(e) => setShowLeaderboardToStudents(e.target.checked)}
                  className="w-5 h-5 rounded text-[#3b707d] focus:ring-[#3b707d]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    إبراز منصة التتويج للمراكز الثلاثة الأولى (Podium)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    عرض منصة الشرف الذهبية والفضية والبرونزية في قمة الصفحة
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showPodium}
                  onChange={(e) => setShowPodium(e.target.checked)}
                  className="w-5 h-5 rounded text-[#3b707d] focus:ring-[#3b707d]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    السماح باستعراض ملف إنجازات الطالب القرائية
                  </span>
                  <span className="text-[11px] text-slate-500">
                    تمكين النقر على اسم الطالب لعرض شهاداته ومستوياته وفق معايير الخصوصية
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={allowStudentDetailModal}
                  onChange={(e) => setAllowStudentDetailModal(e.target.checked)}
                  className="w-5 h-5 rounded text-[#3b707d] focus:ring-[#3b707d]"
                />
              </label>
            </div>
          </div>

          {/* 2. الخصوصية وأسلوب عرض الأسماء */}
          <div className="p-4 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#3b707d]" />
              <span>خصوصية الطلاب وطريقة عرض الأسماء</span>
            </h4>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                أسلوب عرض اسم الطالب للجمهور:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  {
                    id: 'full_name',
                    title: 'الاسم الثلاثي أو الرباعي كاملاً',
                    desc: 'مثال: عبدالله بن حسين الأودن',
                  },
                  {
                    id: 'first_and_family',
                    title: 'الاسم الأول والعائلة فقط',
                    desc: 'مثال: عبدالله الأودن',
                  },
                  {
                    id: 'first_name_only',
                    title: 'الاسم الأول فقط',
                    desc: 'مثال: عبدالله',
                  },
                  {
                    id: 'pseudonym',
                    title: 'اسم مستعار مشفر مع الكود',
                    desc: 'مثال: فارس القراءة #102',
                  },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      nameDisplayMode === opt.id
                        ? 'bg-[#e3ecf3] border-[#3b707d] text-[#1c353d]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="nameDisplayMode"
                        value={opt.id}
                        checked={nameDisplayMode === opt.id}
                        onChange={() => setNameDisplayMode(opt.id as NameDisplayMode)}
                        className="text-[#3b707d] focus:ring-[#3b707d]"
                      />
                      <span className="font-black text-xs">{opt.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 mr-5">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 3. الفترات والحد الأدنى */}
          <div className="p-4 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#3b707d]" />
              <span>الفترة الزمنية الافتراضية والحد الأدنى للظهور</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الفترة الزمنية الافتراضية عند فتح الصفحة:
                </label>
                <select
                  value={defaultPeriod}
                  onChange={(e) => setDefaultPeriod(e.target.value as LeaderboardPeriod)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                >
                  <option value="all_time">الترتيب الإجمالي (منذ الانطلاق)</option>
                  <option value="month">ترتيب هذا الشهر</option>
                  <option value="week">ترتيب هذا الأسبوع</option>
                  <option value="today">ترتيب اليوم</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الحد الأدنى للصفحات المقروءة للظهور:
                </label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={minPagesToAppear}
                  onChange={(e) => setMinPagesToAppear(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] outline-none text-center"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  (0 يعني ظهور جميع الطلاب، 1 يعني استبعاد من لم يقرأ أي صفحة)
                </span>
              </div>
            </div>
          </div>

          {/* 4. استبعاد حسابات الاختبار والحسابات غير النشطة */}
          <div className="p-4 rounded-2xl bg-[#f6f8fa] border border-[#e3ecf3] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>استبعاد حسابات الاختبار والطلاب غير النشطين</span>
              </h4>
              <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                {excludedStudentIds.length} مستبعد
              </span>
            </div>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  استبعاد الطلاب غير النشطين تلقائياً
                </span>
                <span className="text-[11px] text-slate-500">
                  إخفاء أي طالب رصيده 0 صفحة في الفترة المختارة
                </span>
              </div>
              <input
                type="checkbox"
                checked={excludeInactiveStudents}
                onChange={(e) => setExcludeInactiveStudents(e.target.checked)}
                className="w-5 h-5 rounded text-[#3b707d] focus:ring-[#3b707d]"
              />
            </label>

            {/* قائمة الطلاب للاستبعاد اليدوي (حسابات تجارب المشرفين مثلاً) */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700">
                تحديد طلاب أو حسابات تجريبية لاستبعادهم بالاسم:
              </label>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="ابحث باسم الطالب أو رقمه للاستبعاد..."
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
              />

              <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-xl bg-white border border-slate-200 text-xs">
                {filteredStudents.length === 0 ? (
                  <div className="text-center text-slate-400 py-3 text-[11px]">لا يوجد طلاب مطابقون</div>
                ) : (
                  filteredStudents.map((s) => {
                    const isEx = excludedStudentIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleToggleExcludeStudent(s.id)}
                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer text-xs transition-colors ${
                          isEx
                            ? 'bg-rose-50 text-rose-800 border border-rose-200 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isEx}
                            readOnly
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span>{s.fullName}</span>
                          <span className="text-[10px] text-slate-400">({s.groupName})</span>
                        </div>
                        {isEx && <span className="text-[10px] text-rose-700 font-bold">مستبعد</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
