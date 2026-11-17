import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLibrary } from '../../../context/LibraryContext';
import { useNotifications } from '../../../context/NotificationContext';
import {
  LibrarySettings,
  SettingsSnapshot,
  LeaderboardPeriod,
  NameDisplayMode,
  DiscussionApprovalAuthority,
} from '../../../types';
import { Button } from '../../common/Button';
import { Modal } from '../../common/Modal';
import { formatArabicDate, formatArabicDateTime } from '../../../lib/dateUtils';
import {
  getEffectiveSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection,
  isSupabaseConfigured,
} from '../../../lib/supabase';
import { centralSync } from '../../../lib/sync/centralSyncService';
import {
  Settings,
  Zap,
  CloudOff,
  BookOpen,
  Calendar,
  Clock,
  Users,
  Shield,
  QrCode,
  Bell,
  FileText,
  Database,
  History,
  CheckCircle,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Palette,
  ClipboardCheck,
  UserCheck,
  Trophy,
  MessageSquare,
  FileQuestion,
  Search,
  Activity,
  Sliders,
  Eye,
  RotateCcw,
  Sparkles,
  Lock,
  Globe,
  Radio,
  Flame,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  Server,
  HardDrive,
  Cpu,
  Layers,
  GraduationCap,
  MessageSquareText,
  BadgeAlert,
  Save,
  Undo2,
  Compass,
} from 'lucide-react';

export interface UnifiedSettingsCenterProps {
  initialTab?: string;
}

export type SettingsNavTab =
  | 'overview'
  | 'database_sync'
  | 'identity'
  | 'features'
  | 'users_auth'
  | 'books_catalog'
  | 'loans_returns'
  | 'reading_completions'
  | 'discussions_eval'
  | 'exams_rules'
  | 'achievements_ranks'
  | 'comms_chat'
  | 'notifications'
  | 'reports_export'
  | 'datetime_timing'
  | 'site_operations'
  | 'snapshots_history'
  | 'backup_restore'
  | 'audit_log'
  | 'danger_zone';

export const UnifiedSettingsCenter: React.FC<UnifiedSettingsCenterProps> = ({
  initialTab = 'overview',
}) => {
  const { currentStaff } = useAuth();
  const {
    settings,
    updateSettings,
    rollbackSettingsSnapshot,
    exportDatabaseBackup,
    importDatabaseBackup,
    resetToDefaults,
    clearAllData,
    students,
    books,
    copies,
    loans,
    discussions,
    discussionSettings,
    updateDiscussionSettings,
    achievementSettings,
    updateAchievementSettings,
    readingRanks,
    certificateSettings,
    updateCertificateSettings,
    readingLogs,
    exams,
    auditLogs,
    chatSettings,
    updateChatSettings,
    reportSettings,
    updateReportSettings,
  } = useLibrary();

  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<SettingsNavTab>(
    (initialTab as SettingsNavTab) || 'overview'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [rollbackConfirmSnap, setRollbackConfirmSnap] = useState<SettingsSnapshot | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [keepStudentsOnClear, setKeepStudentsOnClear] = useState(true);

  // Cloud Database & Sync state
  const effectiveCloudConfig = useMemo(() => getEffectiveSupabaseConfig(), []);
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(effectiveCloudConfig.url || '');
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(effectiveCloudConfig.anonKey || '');
  const [isTestingCloud, setIsTestingCloud] = useState(false);
  const [cloudTestMessage, setCloudTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState(() => centralSync.getStatus());

  useEffect(() => {
    return centralSync.subscribeToStatus((s) => setSyncStatus(s));
  }, []);

  const handleTestCloudConnection = async () => {
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      setCloudTestMessage({ ok: false, text: 'يرجى إدخال رابط المشروع ومفتاح الوصول (Anon Key) أولاً.' });
      return;
    }
    setIsTestingCloud(true);
    setCloudTestMessage(null);
    try {
      const res = await testSupabaseConnection(supabaseUrlInput, supabaseKeyInput);
      if (res.ok) {
        setCloudTestMessage({
          ok: true,
          text: `تم الاتصال بقاعدة بيانات Supabase المركزية بنجاح! سرعة الاستجابة: ${res.latencyMs} ms ⚡`,
        });
      } else {
        setCloudTestMessage({
          ok: false,
          text: `فشل الاتصال: ${res.error || 'تأكد من صحة الرابط ومفتاح Anon'}`,
        });
      }
    } finally {
      setIsTestingCloud(false);
    }
  };

  const handleSaveCloudConfig = async () => {
    if (!supabaseUrlInput.trim() || !supabaseKeyInput.trim()) {
      showToast('يرجى إدخال رابط ومفتاح Supabase أولاً', 'warning');
      return;
    }
    saveCustomSupabaseConfig(supabaseUrlInput, supabaseKeyInput);
    centralSync.connectCloudRealtime();
    showToast('تم حفظ وتفعيل الاتصال السحابي المركزي بنجاح! 🚀', 'success');
    setCloudTestMessage({
      ok: true,
      text: 'قاعدة البيانات المركزية متصلة الآن وجميع التعديلات ستنعكس فورياً على كافة الأجهزة.',
    });
  };

  const handleClearCloudConfig = () => {
    clearCustomSupabaseConfig();
    setSupabaseUrlInput('');
    setSupabaseKeyInput('');
    centralSync.connectCloudRealtime();
    showToast('تم مسح إعدادات السحابة المخصصة والعودة للوضع الافتراضي', 'info');
    setCloudTestMessage(null);
  };

  // Draft local state for editing
  const [formState, setFormState] = useState<LibrarySettings>(settings);

  // Sync draft with global settings on initial load or rollback
  useEffect(() => {
    if (settings) {
      setFormState({
        ...settings,
        libraryName: settings.libraryName || 'مكتبة مداد',
        libraryEnglishName: settings.libraryEnglishName || 'MIDAD Smart Library',
        teamName: settings.teamName || 'مداد | MIDAD',
        logoUrl: settings.logoUrl || '/midad-logo.jpg',
        primaryColor: settings.primaryColor || '#284d57',
        secondaryColor: settings.secondaryColor || '#3b707d',
        fontFamily: settings.fontFamily || 'cairo',
        timezone: settings.timezone || 'Asia/Riyadh',
        selectableLoanDurations: settings.selectableLoanDurations || [7, 14, 21],
        featureFlags: {
          exams: true,
          discussions: true,
          achievements: true,
          chat: true,
          reservations: true,
          exchanges: true,
          qrLogin: true,
          readingCompletions: true,
          soundEffects: true,
          ...settings.featureFlags,
        },
        announcementBanner: {
          enabled: false,
          text: '',
          type: 'info',
          ...settings.announcementBanner,
        },
      });
    }
  }, [settings]);

  // Track if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    try {
      const keysToIgnore = ['settingsSnapshots', 'lastBackupDate'];
      for (const key of Object.keys(formState) as (keyof LibrarySettings)[]) {
        if (keysToIgnore.includes(key)) continue;
        if (JSON.stringify(formState[key]) !== JSON.stringify(settings[key])) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }, [formState, settings]);

  const handleFieldChange = <K extends keyof LibrarySettings>(key: K, value: LibrarySettings[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleFeatureFlagChange = (flagKey: string, val: boolean) => {
    setFormState((prev) => ({
      ...prev,
      featureFlags: {
        ...(prev.featureFlags || {
          exams: true,
          discussions: true,
          achievements: true,
          chat: true,
          reservations: true,
          exchanges: true,
          qrLogin: true,
          readingCompletions: true,
        }),
        [flagKey]: val,
      },
    }));
  };

  const handleSaveAll = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateSettings(formState, {
      staffId: currentStaff?.id,
      staffName: currentStaff?.fullName || 'إدارة النظام',
      summary: `تحديث مركز الإعدادات من قسم (${activeTab})`,
    });
    showToast('تم حفظ وتطبيق جميع الإعدادات وتحديث قاعدة البيانات بنجاح! 🚀', 'success');
  };

  const handleRevertChanges = () => {
    setFormState(settings);
    showToast('تم إلغاء التعديلات واستعادة القيم الأصلية', 'info');
  };

  const handleConfirmRollback = () => {
    if (!rollbackConfirmSnap) return;
    const res = rollbackSettingsSnapshot(rollbackConfirmSnap.id, {
      staffId: currentStaff?.id,
      staffName: currentStaff?.fullName,
    });
    if (res.success) {
      showToast(`تمت استعادة إعدادات نسخة (${formatArabicDateTime(rollbackConfirmSnap.timestamp)}) بنجاح!`, 'success');
      setRollbackConfirmSnap(null);
    } else {
      showToast(res.error || 'تعذرت الاستعادة', 'error');
    }
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportDatabaseBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `midad_library_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('تم تصدير النسخة الاحتياطية المركزية الشاملة بنجاح 💾', 'success');
  };

  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDatabaseBackup(content);
      if (res.success) {
        showToast('تمت استعادة قاعدة البيانات والملفات المركزية بنجاح!', 'success');
      } else {
        showToast(res.error || 'فشلت استعادة النسخة الاحتياطية', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Nav Groups & Tabs
  const navTabs: {
    id: SettingsNavTab;
    title: string;
    description: string;
    icon: React.ReactNode;
    category: 'core' | 'operations' | 'academic' | 'system';
    badge?: string;
  }[] = [
    {
      id: 'overview',
      title: 'لوحة صحة النظام والمؤشرات',
      description: 'حالة الخدمات، قاعدة البيانات، وسرعة الاستجابة',
      icon: <Activity className="w-4 h-4 text-emerald-600" />,
      category: 'core',
      badge: 'نشط 🟢',
    },
    {
      id: 'database_sync',
      title: 'قاعدة البيانات والمزامنة الفورية',
      description: 'الربط السحابي المركزي، البث اللحظي، ومعالجة التعارضات',
      icon: <Database className="w-4 h-4 text-emerald-600" />,
      category: 'core',
      badge: 'مزامنة ⚡',
    },
    {
      id: 'identity',
      title: 'الهوية والموقع والمظهر',
      description: 'اسم المكتبة، الشعار، الألوان، الخطوط، والتذييل',
      icon: <Palette className="w-4 h-4 text-indigo-600" />,
      category: 'core',
    },
    {
      id: 'features',
      title: 'إدارة الخصائص والمميزات',
      description: 'تشغيل أو إيقاف الميزات البرمجية دون حذف بياناتها',
      icon: <Sliders className="w-4 h-4 text-amber-600" />,
      category: 'core',
      badge: 'متطور',
    },
    {
      id: 'users_auth',
      title: 'المستخدمين والحسابات والأمان',
      description: 'تسجيل دخول الطلاب، بطاقات QR، والجلسات',
      icon: <UserCheck className="w-4 h-4 text-sky-600" />,
      category: 'operations',
    },
    {
      id: 'books_catalog',
      title: 'إدارة الكتب والنسخ والفهرس',
      description: 'ظهور الأغلفة، الحقول الإلزامية، وترتيب الكتب',
      icon: <BookOpen className="w-4 h-4 text-[#3b707d]" />,
      category: 'operations',
    },
    {
      id: 'loans_returns',
      title: 'الإعارة والإرجاع والحجز',
      description: 'مدد الإعارة، عدد الكتب، الحجز، وفحص النسخ',
      icon: <Calendar className="w-4 h-4 text-emerald-700" />,
      category: 'operations',
    },
    {
      id: 'reading_completions',
      title: 'القراءة وإكمال الكتب',
      description: 'توثيق قراءة الكتب، اعتماد المشرف، والسجل',
      icon: <ClipboardCheck className="w-4 h-4 text-teal-600" />,
      category: 'academic',
    },
    {
      id: 'discussions_eval',
      title: 'المناقشات القرائية والتقييم',
      description: 'معايير التحكيم، الدرجات، ونقاط المناقشات',
      icon: <MessageSquareText className="w-4 h-4 text-cyan-600" />,
      category: 'academic',
    },
    {
      id: 'exams_rules',
      title: 'الاختبارات الإلكترونية',
      description: 'ضوابط الاختبارات، أنواع الأسئلة، والمؤقت',
      icon: <FileQuestion className="w-4 h-4 text-purple-600" />,
      category: 'academic',
    },
    {
      id: 'achievements_ranks',
      title: 'الإنجازات والمستويات القرائية',
      description: 'لوحة المتصدرين، سُلّم المستويات، والشهادات',
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
      category: 'academic',
    },
    {
      id: 'comms_chat',
      title: 'المحادثات والتواصل الداخلي',
      description: 'مراسلة الطلاب والمشرفين، والمرفقات',
      icon: <MessageSquare className="w-4 h-4 text-blue-600" />,
      category: 'system',
    },
    {
      id: 'notifications',
      title: 'الإشعارات والتنبيهات',
      description: 'أجراس التنبيه، إشعارات التأخير، والمواعيد',
      icon: <Bell className="w-4 h-4 text-rose-500" />,
      category: 'system',
    },
    {
      id: 'reports_export',
      title: 'التقارير والتصدير والشهادات',
      description: 'ترويسة التقارير، التواقيع، وصيغ التصدير',
      icon: <FileText className="w-4 h-4 text-slate-700" />,
      category: 'system',
    },
    {
      id: 'datetime_timing',
      title: 'التاريخ والتوقيت والتقويم',
      description: 'المنطقة الزمنية، التقويم الهجري وأم القرى',
      icon: <Clock className="w-4 h-4 text-emerald-800" />,
      category: 'system',
    },
    {
      id: 'site_operations',
      title: 'تشغيل الموقع والصيانة والإعلانات',
      description: 'وضع الصيانة، شريط الإعلانات، ومزامنة السحابة',
      icon: <Globe className="w-4 h-4 text-sky-700" />,
      category: 'system',
    },
    {
      id: 'snapshots_history',
      title: 'سجل نسخ الإعدادات والاستعادة',
      description: 'تاريخ التعديلات واستعادة أي نسخة بنقرة واحدة',
      icon: <History className="w-4 h-4 text-amber-700" />,
      category: 'system',
      badge: `${formState.settingsSnapshots?.length || 0} نسخة`,
    },
    {
      id: 'backup_restore',
      title: 'النسخ الاحتياطي واستعادة البيانات',
      description: 'تصدير كامل قاعدة البيانات JSON واستيرادها بأمان',
      icon: <Database className="w-4 h-4 text-blue-700" />,
      category: 'system',
    },
    {
      id: 'audit_log',
      title: 'سجل عمليات وتعديلات النظام',
      description: 'المسؤول، العملية، القيمة السابقة والجديدة',
      icon: <Shield className="w-4 h-4 text-indigo-700" />,
      category: 'system',
    },
    {
      id: 'danger_zone',
      title: 'المنطقة الحساسة وتصفير البيانات',
      description: 'إعادة ضبط المصنع وحذف البيانات التجريبية',
      icon: <Trash2 className="w-4 h-4 text-rose-600" />,
      category: 'system',
    },
  ];

  // Filtering tabs by search query
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return navTabs;
    const q = searchQuery.toLowerCase().trim();
    return navTabs.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [searchQuery, navTabs]);

  return (
    <div className="space-y-6 sm:space-y-8 font-arabic pb-20" dir="rtl">
      {/* 1. الترويسة العليا الاحترافية لمركز التحكم */}
      <div className="relative rounded-3xl bg-gradient-to-l from-[#1c353d] via-[#284d57] to-[#3b707d] p-6 sm:p-8 text-white shadow-xl overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>مركز الإعدادات العامة الشامل</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
                <Radio className="w-3 h-3 animate-ping" />
                <span>مترابط لحظياً بقاعدة البيانات</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-amber-400 shrink-0" />
              <span>إعدادات منظومة مكتبة مداد</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
              مركز التحكم المركزي بجميع خصائص المنصة، الهوية المؤسسية، ضوابط الإعارة والقراءة والمناقشات والاختبارات، ومراقبة صحة النظام دون الحاجة لأي تعديل برمجي.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="md"
              icon={<Eye className="w-4 h-4 text-amber-300" />}
              onClick={() => setIsPreviewOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold text-xs"
            >
              معاينة الواجهة الحية
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              icon={<Save className="w-4 h-4" />}
              onClick={() => handleSaveAll()}
              disabled={!hasUnsavedChanges}
              className={`text-xs font-black shadow-lg ${
                hasUnsavedChanges
                  ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {hasUnsavedChanges ? 'تطبيق وحفظ التعديلات' : 'الإعدادات محفوظة'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. الهيكل الرئيسي: قائمة التصنيفات الجانبية + مساحة العمل */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* الشريط الجانبي لتصنيفات الإعدادات مع البحث الفوري */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-soft space-y-3 sticky top-4">
          {/* مربع البحث السريع في الإعدادات */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن أي إعداد أو خاصية..."
              className="w-full min-h-[40px] pr-9 pl-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
            />
          </div>

          {/* قائمة الأقسام */}
          <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-0.5 scrollbar-thin">
            {filteredTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full p-2.5 rounded-2xl text-right transition-all flex items-center justify-between gap-2 text-xs ${
                    isActive
                      ? 'bg-[#284d57] text-white shadow-md font-black'
                      : 'text-slate-700 hover:bg-slate-100 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`shrink-0 p-1.5 rounded-lg ${isActive ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.title}</span>
                  </div>
                  {tab.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* مساحة العمل: عرض القسم المختار من الإعدادات */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-soft space-y-6">
          {/* ====================================================================
              TAB 0: لوحة صحة النظام والمؤشرات (System Health)
              ==================================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                  لوحة المراقبة الفنية المركزية
                </span>
                <h2 className="text-lg font-black text-slate-900">حالة وصحة منظومة مكتبة مداد</h2>
                <p className="text-xs text-slate-500">
                  فحص لحظي لحالة قواعد البيانات المركزية، أمان المصادقة، التخزين، والمزامنة السحابية
                </p>
              </div>

              {/* بطاقات المؤشرات الأربعة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-right space-y-1">
                  <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                    <span>قاعدة البيانات المركزية</span>
                    <Server className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-lg font-black text-emerald-950 block">متصلة وتعمل بنجاح 🟢</span>
                  <span className="text-[10px] text-emerald-700 font-bold block">مزامنة فورية متعددة التبويبات</span>
                </div>

                <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 text-right space-y-1">
                  <div className="flex items-center justify-between text-sky-800 text-xs font-bold">
                    <span>خدمة المصادقة والأمان</span>
                    <Shield className="w-4 h-4 text-sky-600" />
                  </div>
                  <span className="text-lg font-black text-sky-950 block">محمية ومشفّرة 🔒</span>
                  <span className="text-[10px] text-sky-700 font-bold block">تجزئة SHA-256 للرموز</span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 text-right space-y-1">
                  <div className="flex items-center justify-between text-purple-800 text-xs font-bold">
                    <span>سعة التخزين المستمر</span>
                    <HardDrive className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-lg font-black text-purple-950 block">مساحة آمنة ممتازة</span>
                  <span className="text-[10px] text-purple-700 font-bold block">
                    {Math.round((localStorage.getItem('wathba_library_data_v1')?.length || 0) / 1024)} كيلوبايت مستخدمة
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-right space-y-1">
                  <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
                    <span>النسخ الاحتياطي الآلي</span>
                    <Database className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-lg font-black text-amber-950 block">
                    {formState.settingsSnapshots?.length || 0} نسخة تاريخية
                  </span>
                  <span className="text-[10px] text-amber-800 font-bold block">استعادة فورية عند الحاجة</span>
                </div>
              </div>

              {/* تفاصيل السجلات الحية */}
              <div className="bg-[#f8fafc] p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#3b707d]" />
                  <span>تعداد السجلات النشطة في قاعدة البيانات</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-bold block text-[11px]">الطلاب المسجلون</span>
                    <span className="text-xl font-black text-[#1c353d]">{students.length} طالب</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-bold block text-[11px]">عناوين الكتب</span>
                    <span className="text-xl font-black text-[#284d57]">{books.length} كتاب</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-bold block text-[11px]">النسخ الفعلية المرمزة</span>
                    <span className="text-xl font-black text-[#3b707d]">{copies.length} نسخة</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-slate-500 font-bold block text-[11px]">سجلات القراءة المعتمدة</span>
                    <span className="text-xl font-black text-emerald-700">
                      {readingLogs.filter((l) => l.status === 'approved').length} سجل
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 1: الهوية والموقع والمظهر (Identity & Theme)
              ==================================================================== */}
          {activeTab === 'identity' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">إعدادات الهوية المؤسسية والموقع</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تعديل الاسم الرسمي، الشعار، الألوان الأساسية، الخطوط، والبيانات التعريفية
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">اسم المكتبة بالعربية: *</label>
                  <input
                    type="text"
                    value={formState.libraryName}
                    onChange={(e) => handleFieldChange('libraryName', e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-[#3b707d] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">اسم المكتبة بالإنجليزية: *</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formState.libraryEnglishName}
                    onChange={(e) => handleFieldChange('libraryEnglishName', e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-[#3b707d] outline-none text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">اسم الفريق أو العلامة:</label>
                  <input
                    type="text"
                    value={formState.teamName}
                    onChange={(e) => handleFieldChange('teamName', e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-[#3b707d] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">رابط الشعار الرسمي (Logo URL):</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formState.logoUrl || ''}
                    onChange={(e) => handleFieldChange('logoUrl', e.target.value)}
                    placeholder="/midad-logo.jpg"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-[#3b707d] outline-none text-left"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">شعار المكتبة اللفظي (Slogan):</label>
                  <input
                    type="text"
                    value={formState.slogan || ''}
                    onChange={(e) => handleFieldChange('slogan', e.target.value)}
                    placeholder="مثال: اقرأ لترقى، وتعلّم لتبني"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-[#3b707d] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">رسالة الترحيب الرئيسية:</label>
                  <textarea
                    rows={2}
                    value={formState.welcomeMessage}
                    onChange={(e) => handleFieldChange('welcomeMessage', e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
                  />
                </div>

                {/* خيارات الألوان الأساسية */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">اللون الأساسي (Primary Color):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formState.primaryColor || '#284d57'}
                      onChange={(e) => handleFieldChange('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={formState.primaryColor || '#284d57'}
                      onChange={(e) => handleFieldChange('primaryColor', e.target.value)}
                      className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">اللون الثانوي (Secondary Color):</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formState.secondaryColor || '#3b707d'}
                      onChange={(e) => handleFieldChange('secondaryColor', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-slate-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={formState.secondaryColor || '#3b707d'}
                      onChange={(e) => handleFieldChange('secondaryColor', e.target.value)}
                      className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">الجهة المشرفة الرسمية:</label>
                  <input
                    type="text"
                    value={formState.issuerOrganization || ''}
                    onChange={(e) => handleFieldChange('issuerOrganization', e.target.value)}
                    placeholder="مثال: إدارة التعليم • فريق الإشراف الثقافي"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-[#3b707d] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">معلومات التواصل (هاتف/بريد):</label>
                  <input
                    type="text"
                    value={formState.contactEmail || ''}
                    onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
                    placeholder="library@midad.edu.sa"
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-bold focus:ring-2 focus:ring-[#3b707d] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">نص التذييل وحقوق الملكية:</label>
                  <input
                    type="text"
                    value={formState.copyrightText || ''}
                    onChange={(e) => handleFieldChange('copyrightText', e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-[#3b707d] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 2: إدارة الخصائص والمميزات (Feature Management)
              ==================================================================== */}
          {activeTab === 'features' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                  لوحة التحكم في الميزات والخدمات
                </span>
                <h2 className="text-base font-black text-slate-900 mt-1">تشغيل وإيقاف ميزات المنصة</h2>
                <p className="text-xs text-slate-500">
                  تحكّم في تفعيل أو إيقاف أي قسم برمجياً دون حذف أية بيانات مسجلة.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  {
                    key: 'achievements',
                    title: 'لوحة الشرف والتنافس القرائي 🏆',
                    desc: 'إتاحة لوحة المتصدرين وتنافس قراءات الطلاب للمنصة',
                  },
                  {
                    key: 'readingCompletions',
                    title: 'زر توثيق إكمال قراءة الكتب 📖',
                    desc: 'تمكين الطالب من تقديم طلب إتمام قراءة الكتاب لاعتماده',
                  },
                  {
                    key: 'discussions',
                    title: 'نظام المناقشات القرائية والتقييم 💬',
                    desc: 'إتاحة طلبات المناقشة الفردية والجماعية ورصد الدرجات',
                  },
                  {
                    key: 'exams',
                    title: 'منظومة الاختبارات الإلكترونية 📝',
                    desc: 'إتاحة نماذج الاختبارات والتقييم الذاتي للطلاب',
                  },
                  {
                    key: 'chat',
                    title: 'المحادثات والتواصل الداخلي ✉️',
                    desc: 'تمكين الرسائل النصية المباشرة بين الطلاب والمشرفين',
                  },
                  {
                    key: 'reservations',
                    title: 'حجز النسخ غير المتاحة ⏳',
                    desc: 'تمكين الطلاب من حجز النسخ المستعارة عند نفادها',
                  },
                  {
                    key: 'exchanges',
                    title: 'طلبات استبدال الكتب 🔄',
                    desc: 'السماح للطلاب بتقديم طلب تبديل كتاب مستعار بآخر',
                  },
                  {
                    key: 'qrLogin',
                    title: 'تسجيل الدخول بالباركود السريع (QR) 📷',
                    desc: 'إتاحة مسح البطاقة المدرسية بالماسح أو الكاميرا',
                  },
                ].map((item) => {
                  const isEnabled = Boolean(
                    formState.featureFlags?.[item.key as keyof typeof formState.featureFlags] ?? true
                  );
                  return (
                    <div
                      key={item.key}
                      onClick={() => handleFeatureFlagChange(item.key, !isEnabled)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isEnabled
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 text-slate-500 opacity-80'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="font-black text-xs block">{item.title}</span>
                        <span className="text-[11px] opacity-80 block leading-relaxed">{item.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        readOnly
                        className="w-5 h-5 rounded text-[#284d57] focus:ring-[#284d57] shrink-0 mt-0.5"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 3: المستخدمين والحسابات والأمان (Users, Auth & Security)
              ==================================================================== */}
          {activeTab === 'users_auth' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">إعدادات الدخول والجلسات والأمان</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  إدارة طرق تسجيل دخول الطلاب، صلاحية الجلسات، والحماية من المحاولات المتكررة
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      طريقة دخول الطلاب المعتمدة:
                    </label>
                    <select
                      value={formState.studentLoginMethod || 'both'}
                      onChange={(e) => handleFieldChange('studentLoginMethod', e.target.value as any)}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-bold bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
                    >
                      <option value="both">كود الطالب + رمز الدخول، والباركود QR معاً</option>
                      <option value="qr">دخول عبر الباركود QR فقط</option>
                      <option value="code">دخول عبر كود الطالب ورمز المرور فقط</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مدة صلاحية الجلسة بالدقائق:
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={720}
                      value={formState.sessionTimeoutMinutes ?? 120}
                      onChange={(e) => handleFieldChange('sessionTimeoutMinutes', Number(e.target.value))}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-center focus:ring-2 focus:ring-[#3b707d] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      أقصى محاولات دخول فاشلة قبل التقييد المؤقت:
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={15}
                      value={formState.maxLoginAttempts ?? 5}
                      onChange={(e) => handleFieldChange('maxLoginAttempts', Number(e.target.value))}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-center focus:ring-2 focus:ring-[#3b707d] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مدة تقييد المحاولات الفاشلة (بالدقائق):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={formState.lockoutDurationMinutes ?? 15}
                      onChange={(e) => handleFieldChange('lockoutDurationMinutes', Number(e.target.value))}
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-center focus:ring-2 focus:ring-[#3b707d] outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">السماح بتسجيل دخول الطلاب</span>
                      <span className="text-[11px] text-slate-500">تمكين الطلاب من فتح البوابة الإلكترونية</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.enableStudentLogin !== false}
                      onChange={(e) => handleFieldChange('enableStudentLogin', e.target.checked)}
                      className="w-5 h-5 rounded text-[#284d57] focus:ring-[#284d57]"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">طلب رمز إضافي مع بطاقة QR</span>
                      <span className="text-[11px] text-slate-500">زيادة الأمان لمنع استخدام بطاقة طالب آخر</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.requirePinWithQrLogin ?? false}
                      onChange={(e) => handleFieldChange('requirePinWithQrLogin', e.target.checked)}
                      className="w-5 h-5 rounded text-[#284d57] focus:ring-[#284d57]"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 4: الإعارة والإرجاع والحجز (Loans & Returns)
              ==================================================================== */}
          {activeTab === 'loans_returns' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">إعدادات الإعارة والحجز والإرجاع</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  قواعد المدد الافتراضية، الحد الأقصى للكتب، وفحص النسخ
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">المدة الافتراضية للإعارة (أيام):</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formState.loanDurationDays}
                    onChange={(e) => handleFieldChange('loanDurationDays', Number(e.target.value))}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">أقصى عدد كتب مستعارة للطالب:</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formState.maxLoansPerStudent}
                    onChange={(e) => handleFieldChange('maxLoansPerStudent', Number(e.target.value))}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">صلاحية طلب الحجز (ساعات):</label>
                  <input
                    type="number"
                    min={6}
                    max={168}
                    value={formState.reservationValidityHours}
                    onChange={(e) => handleFieldChange('reservationValidityHours', Number(e.target.value))}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 block">حظر استعارة كتب جديدة إذا كان على الطالب كتاب متأخر</span>
                    <span className="text-[11px] text-slate-500">حماية النسخ وتحفيز الطلاب على الالتزام بالمواعيد</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formState.blockLoanIfOverdue}
                    onChange={(e) => handleFieldChange('blockLoanIfOverdue', e.target.checked)}
                    className="w-5 h-5 rounded text-[#284d57]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 block">إلزام فحص حالة الكتاب على رف الإرجاع قبل إتاحته للإعارة ثانية</span>
                    <span className="text-[11px] text-slate-500">ضمان سلامة النسخ ونظافتها قبل تسليمها لطالب آخر</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formState.requireConditionPhotosOnReturn}
                    onChange={(e) => handleFieldChange('requireConditionPhotosOnReturn', e.target.checked)}
                    className="w-5 h-5 rounded text-[#284d57]"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <div>
                    <span className="font-bold text-slate-800 block">السماح بحجز النسخ المستعارة عند عدم توفر نسخ على الرف</span>
                    <span className="text-[11px] text-slate-500">قائمة انتظار ذكية تُشعر الطالب فور إرجاع النسخة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formState.allowBackorderReservation !== false}
                    onChange={(e) => handleFieldChange('allowBackorderReservation', e.target.checked)}
                    className="w-5 h-5 rounded text-[#284d57]"
                  />
                </label>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 5: تشغيل الموقع والصيانة والإعلانات (Operations & Maintenance)
              ==================================================================== */}
          {activeTab === 'site_operations' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">إعدادات تشغيل الموقع، الصيانة، والإعلانات</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  وضع الصيانة الطارئ، شريط التنبيهات العام، وحالة التزامن
                </p>
              </div>

              {/* بطاقة وضع الصيانة */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-black">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>وضع الصيانة المؤقت للمنصة (Maintenance Mode)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(formState.isMaintenanceMode)}
                    onChange={(e) => handleFieldChange('isMaintenanceMode', e.target.checked)}
                    className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500"
                  />
                </div>

                <p className="text-[11px] text-amber-800 leading-relaxed">
                  عند تفعيل هذا الخيار، سيتم حجب واجهات الطلاب وإظهار رسالة الصيانة، بينما يبقى الدخول متاحاً للمشرفين والإدارة.
                </p>

                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">رسالة الصيانة التي تظهر للمستخدمين:</label>
                  <textarea
                    rows={2}
                    value={formState.maintenanceMessage || ''}
                    onChange={(e) => handleFieldChange('maintenanceMessage', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* شريط الإعلانات العام لجميع المستخدمين */}
              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sky-900 font-black">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>شريط الإعلانات الترحيبي العام أعلى المنصة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(formState.announcementBanner?.enabled)}
                    onChange={(e) =>
                      handleFieldChange('announcementBanner', {
                        ...(formState.announcementBanner || { type: 'info', text: '' }),
                        enabled: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded text-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-sky-900 mb-1">نص الإعلان أو التنبيه:</label>
                  <input
                    type="text"
                    value={formState.announcementBanner?.text || ''}
                    onChange={(e) =>
                      handleFieldChange('announcementBanner', {
                        ...(formState.announcementBanner || { enabled: true, type: 'info' }),
                        text: e.target.value,
                      })
                    }
                    placeholder="مثال: انطلاق تحدي القراءة الفصلي بمكتبة مداد! استعيروا كتبكم الآن."
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-sky-300 bg-white text-xs font-bold outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 6: سجل نسخ الإعدادات والاستعادة (Snapshots & Rollback)
              ==================================================================== */}
          {activeTab === 'snapshots_history' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                    نظام النسخ التاريخية والـ Rollback
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">سجل نسخ الإعدادات والاستعادة</h2>
                  <p className="text-xs text-slate-500">
                    استعرض محفوظات التعديلات السابقة واستعد أي حالة سابقة للإعدادات بنقرة واحدة آمنة.
                  </p>
                </div>

                <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                  {formState.settingsSnapshots?.length || 0} إصدار محفوظ
                </span>
              </div>

              {!formState.settingsSnapshots || formState.settingsSnapshots.length === 0 ? (
                <div className="p-12 bg-[#f8fafc] rounded-2xl border border-slate-200 text-center space-y-2 text-xs text-slate-500">
                  <History className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">لا توجد نسخ تاريخية محفوظة بعد</p>
                  <p className="text-[11px]">سيتم حفظ نسخة تلقائياً مع كل عملية تعديل وتطبيق للإعدادات.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {formState.settingsSnapshots.map((snap, idx) => (
                    <div
                      key={snap.id}
                      className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 hover:border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">إصدار #{formState.settingsSnapshots!.length - idx}</span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {formatArabicDateTime(snap.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-600 font-bold">{snap.summary || 'تعديل الإعدادات العامة'}</p>
                        <span className="text-[10px] text-slate-400">بواسطة: {snap.authorName || 'إدارة النظام'}</span>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={() => setRollbackConfirmSnap(snap)}
                        className="text-xs font-bold bg-white hover:bg-amber-50 text-amber-900 border-amber-300 shrink-0"
                      >
                        استعادة هذه النسخة
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 7: النسخ الاحتياطي واستعادة البيانات (Backup & Restore)
              ==================================================================== */}
          {activeTab === 'backup_restore' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-black text-slate-900">النسخ الاحتياطي الكامل وتصدير البيانات</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  حفظ نسخة من جميع سجلات الطلاب، الكتب، الإعارات، القراءات، المناقشات، والاختبارات
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* تنزيل النسخة الاحتياطية */}
                <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-right space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-emerald-950">تصدير وتنزيل نسخة احتياطية كاملة</h3>
                    <p className="text-[11px] text-emerald-800 leading-relaxed mt-1">
                      ملف JSON متكامل يحتوي على كافة جداول وبيانات المكتبة المركزية بصيغة قياسية آمنة.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleDownloadBackup}
                    icon={<Download className="w-4 h-4" />}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs"
                  >
                    تنزيل النسخة الاحتياطية الآن
                  </Button>
                </div>

                {/* استعادة من ملف */}
                <div className="p-5 rounded-2xl bg-sky-50/70 border border-sky-200 text-right space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-sky-950">استعادة من ملف نسخة احتياطية</h3>
                    <p className="text-[11px] text-sky-800 leading-relaxed mt-1">
                      رفع ملف JSON تم تصديره مسبقاً لاستعادة البيانات بصلاحيات الإدارة العامة.
                    </p>
                  </div>
                  <label className="block w-full">
                    <span className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-[#284d57] hover:bg-[#1c353d] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm">
                      <Upload className="w-4 h-4" />
                      <span>اختيار ملف النسخة واستعادتها</span>
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreBackupFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 8: سجل عمليات وتعديلات النظام (Audit Log)
              ==================================================================== */}
          {activeTab === 'audit_log' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900">سجل عمليات وتعديلات النظام</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    توثيق مباشر لكل حركة حساسة في النظام: من قام بالتعديل، نوع العملية، والتوقيت
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {auditLogs.length} عملية مسجلة
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                {auditLogs.slice(0, 30).map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{log.action}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono">
                          {log.entityType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{log.notes || 'توثيق عملية نظام'}</p>
                      <span className="text-[10px] text-slate-400">
                        المنفذ: {log.actorName} ({log.actorType})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {formatArabicDateTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB 9: المنطقة الحساسة وتصفير البيانات (Danger Zone)
              ==================================================================== */}
          {activeTab === 'danger_zone' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-rose-200 pb-3">
                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                  منطقة الخطر الإدارية
                </span>
                <h2 className="text-base font-black text-rose-950 mt-1">تصفير أو حذف البيانات</h2>
                <p className="text-xs text-slate-500">
                  إجراءات حاسمة لا ينبغي استخدامها إلا عند إعادة ضبط المصنع أو بدء عام دراسي جديد.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-xs text-amber-950">إعادة ضبط الإعدادات للوضع الافتراضي</h3>
                    <p className="text-[11px] text-amber-800">
                      استعادة الإعدادات الأصلية الافتراضية مع الاحتفاظ ببيانات الطلاب والكتب.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="text-xs font-bold bg-white text-amber-900 border-amber-300 shrink-0"
                  >
                    استعادة الإعدادات الافتراضية
                  </Button>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-xs text-rose-950">تفريغ وحذف السجلات التجريبية</h3>
                    <p className="text-[11px] text-rose-800">
                      حذف الكتب والنسخ والإعارات التجريبية لبدء المكتبة على نظافة تامة.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setIsClearDataOpen(true)}
                    className="text-xs font-bold shrink-0"
                  >
                    فتح نافذة التفريغ
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}

          {/* Fallback for other tabs that are modularly configurable */}
          {['books_catalog', 'reading_completions', 'discussions_eval', 'exams_rules', 'achievements_ranks', 'comms_chat', 'notifications', 'reports_export', 'datetime_timing'].includes(activeTab) && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    {navTabs.find((t) => t.id === activeTab)?.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {navTabs.find((t) => t.id === activeTab)?.description}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  متصل ومربوط حياً
                </span>
              </div>

              {/* Specific tab settings */}
              {activeTab === 'books_catalog' && (
                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">عرض صور أغلفة الكتب للطلاب</span>
                      <span className="text-[11px] text-slate-500">إظهار صور الأغلفة في الفهرس والبطاقات</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.showBookCovers !== false}
                      onChange={(e) => handleFieldChange('showBookCovers', e.target.checked)}
                      className="w-5 h-5 rounded text-[#284d57]"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">إظهار الكتب غير المتاحة (المستعارة بالكامل)</span>
                      <span className="text-[11px] text-slate-500">عرضها مع شارة "مستعار حالياً" وإمكانية الحجز</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.showUnavailableBooks !== false}
                      onChange={(e) => handleFieldChange('showUnavailableBooks', e.target.checked)}
                      className="w-5 h-5 rounded text-[#284d57]"
                    />
                  </label>
                </div>
              )}

              {activeTab === 'reading_completions' && (
                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">تفعيل زر "أتممت قراءة هذا الكتاب" في كتبي المستعارة</span>
                      <span className="text-[11px] text-slate-500">تمكين الطالب من إرسال طلب إكمال القراءة</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.enableBookCompletionButton !== false}
                      onChange={(e) => handleFieldChange('enableBookCompletionButton', e.target.checked)}
                      className="w-5 h-5 rounded text-[#284d57]"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <div>
                      <span className="font-bold text-slate-800 block">اشتراط اعتماد المشرف لإكمال القراءة لتوثيق الصفحات بالسجل</span>
                      <span className="text-[11px] text-slate-500">منع الاحتساب التلقائي دون موافقة تربوية من المشرف</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.requireReviewForBookCompletion !== false}
                      onChange={(e) => handleFieldChange('requireReviewForBookCompletion', e.target.checked)}
                      className="w-5 h-5 rounded text-[#284d57]"
                    />
                  </label>
                </div>
              )}

              {activeTab === 'discussions_eval' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">نظام احتساب نقاط المناقشات</span>
                      <span className="text-[11px] text-slate-500">
                        {discussionSettings.pointsPerDiscussion || 10} نقاط لكل مناقشة معتمدة
                      </span>
                    </div>
                    <span className="text-xs font-black text-[#284d57] font-mono">
                      الدرجة العظمى: {discussionSettings.totalMaxPoints || 100}
                    </span>
                  </div>
                </div>
              )}

              {activeTab === 'achievements_ranks' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                    <span className="font-bold text-amber-900 block">إعدادات لوحة الشرف المعتمدة:</span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      لوحة المتصدرين مفعلة بنظام المستويات الخمسة (دبلوم 100ص، بكالوريوس 300ص، ماجستير 600ص، دكتوراه 1000ص، وثّاب 1500ص).
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'datetime_timing' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 block">المنطقة الزمنية الرسمية للمكتبة</span>
                      <span className="text-[11px] text-slate-500">توقيت مكة المكرمة والمملكة العربية السعودية</span>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-mono font-bold">
                      Asia/Riyadh (GMT+3)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====================================================================
              TAB: قاعدة البيانات المركزية والمزامنة الفورية (Cloud Database & Live Sync)
              ==================================================================== */}
          {activeTab === 'database_sync' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    قاعدة البيانات السحابية المركزية الموحدة
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">
                    المزامنة الفورية والتحديث المباشر بين جميع الأجهزة
                  </h2>
                  <p className="text-xs text-slate-500">
                    ربط منصة مداد بقاعدة بيانات مركزية واحدة تنعكس عليها جميع الإضافات والتعديلات والطلبات فورياً على كافة الأجهزة المفتوحة دون الحاجة لتحديث الصفحة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black border ${
                      syncStatus.isCloudConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : syncStatus.state === 'offline'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-[#e3ecf3] text-[#284d57] border-[#c5d8df]'
                    }`}
                  >
                    {syncStatus.label}
                  </span>
                </div>
              </div>

              {/* بطاقات تشخيص حالة المزامنة والاتصال */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>حالة البث اللحظي (Realtime)</span>
                    <Radio className={`w-4 h-4 ${syncStatus.isCloudConnected ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block">
                    {syncStatus.isCloudConnected ? 'بث سحابي لحظي نشط ⚡' : 'بث محلي بين التبويبات'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">
                    قناة البث: midad_central_sync_v1
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سرعة الاستجابة (Latency)</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.latencyMs !== undefined ? `${syncStatus.latencyMs} ms` : 'فوري (محلي)'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">زمن نقل واستلام التعديل</span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>قائمة الانتظار في وضع الأوفلاين</span>
                    <CloudOff className="w-4 h-4 text-sky-600" />
                  </div>
                  <strong className="text-sm font-black text-slate-900 block font-mono">
                    {syncStatus.pendingOutboxCount} عمليات مؤجلة
                  </strong>
                  <span className="text-[10px] text-slate-500 block">تُرفع تلقائياً عند عودة الإنترنت</span>
                </div>
              </div>

              {/* قسم إعدادات الاتصال بقاعدة بيانات Supabase المركزية */}
              <div className="bg-[#f8fafc] p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-[#284d57]" />
                    <div>
                      <h3 className="font-black text-sm text-slate-900">بيانات الاتصال بقاعدة البيانات السحابية (Supabase)</h3>
                      <p className="text-[11px] text-slate-500">
                        يمكنك ربط المنصة مباشرة بمشروع Supabase الخاص بك لتعمل المنصة مركزياً بين جميع الأجهزة والهواتف والموقع المنشور.
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-600">
                    المصدر: {effectiveCloudConfig.source === 'custom_settings' ? 'إعدادات الإدارة المخصصة' : effectiveCloudConfig.source === 'env' ? 'متغيرات البيئة (.env)' : 'غير مربوط'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رابط مشروع Supabase (Project URL): *
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={supabaseUrlInput}
                      onChange={(e) => setSupabaseUrlInput(e.target.value)}
                      placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      مفتاح الوصول العام (Anon Public Key): *
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={supabaseKeyInput}
                      onChange={(e) => setSupabaseKeyInput(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-xs bg-white outline-none focus:ring-2 focus:ring-[#3b707d]"
                    />
                  </div>
                </div>

                {cloudTestMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                      cloudTestMessage.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {cloudTestMessage.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{cloudTestMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleTestCloudConnection}
                    disabled={isTestingCloud}
                    icon={<Activity className="w-4 h-4" />}
                    className="bg-[#3b707d] hover:bg-[#284d57] text-white text-xs font-bold"
                  >
                    {isTestingCloud ? 'جارٍ فحص الاتصال...' : 'فحص واختبار الاتصال الحي ⚡'}
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleSaveCloudConfig}
                    icon={<Save className="w-4 h-4" />}
                    className="bg-[#284d57] hover:bg-[#1c353d] text-white text-xs font-bold"
                  >
                    حفظ وتفعيل الاتصال السحابي المركزي
                  </Button>

                  {effectiveCloudConfig.source === 'custom_settings' && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleClearCloudConfig}
                      icon={<Trash2 className="w-4 h-4" />}
                      className="text-xs text-rose-700 hover:bg-rose-50 border-rose-200"
                    >
                      إلغاء الربط المخصص
                    </Button>
                  )}
                </div>
              </div>

              {/* أدوات المزامنة اليدوية والتفريغ */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-[#3b707d]" />
                  <span>عمليات المزامنة والتحديث الفوري الشامل</span>
                </h3>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  تضمن هذه الأدوات سحب أي بيانات جديدة تمت من أجهزة أخرى، أو تفريغ العمليات المحفوظة أثناء انقطاع الاتصال ومزامنتها فورياً.
                </p>

                <div className="flex flex-wrap items-center gap-2.5">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      centralSync.flushOutbox();
                      centralSync.pingCloudHealth();
                      showToast('تم إطلاق فحص المزامنة الفوري لكافة السجلات', 'info');
                    }}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    مزامنة وتحديث فوري الآن
                  </Button>
                </div>
              </div>

              {/* إرشادات تطبيق مخطط قاعدة البيانات الشامل */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <h4 className="font-black text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3b707d]" />
                  <span>مخطط الجداول وسياسات الأمان المتكامل (supabase/schema.sql)</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  تم تجهيز ملف <strong>supabase/schema.sql</strong> داخل مجلد المشروع شاملاً جميع الجداول الـ 28 (الكتب، النسخ، الطلاب، الإعارات، الحجوزات، إكمال القراءة، المناقشات، الاختبارات، الشهادات، الإعدادات، والمحادثات) مع سياسات الأمان RLS وتفعيل البث اللحظي (Realtime) عليها جميعاً.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. شريط التعديلات غير المحفوظة العائم (Floating Unsaved Banner) */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-8 sm:right-8 z-40 bg-[#1c353d] text-white p-4 rounded-2xl shadow-2xl border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black">
              <Sparkles className="w-4 h-4 animate-spin" />
            </span>
            <div>
              <span className="font-black text-sm block">لديك تعديلات غير محفوظة في مركز الإعدادات!</span>
              <span className="text-[11px] text-slate-300">
                اضغط على زر التطبيق لحفظ التعديلات في قاعدة البيانات ومزامنتها لجميع الأجهزة والحسابات.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleRevertChanges}
              icon={<Undo2 className="w-3.5 h-3.5" />}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold"
            >
              تراجع
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleSaveAll()}
              icon={<Save className="w-4 h-4" />}
              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-lg"
            >
              تطبيق وحفظ التعديلات الآن
            </Button>
          </div>
        </div>
      )}

      {/* 4. نافذة المعاينة الحية قبل التطبيق (Preview Mode) */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl bg-[#f4f7f9] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="p-4 bg-[#1c353d] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="font-black text-sm">معاينة واجهة الموقع الحية وفق الإعدادات الحالية</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* شريط الإعلان المعاين */}
              {formState.announcementBanner?.enabled && (
                <div className="p-3 rounded-2xl bg-sky-500 text-white text-xs font-bold text-center shadow-xs">
                  {formState.announcementBanner.text}
                </div>
              )}

              {/* رأس الموقع المعاين */}
              <div
                className="p-6 rounded-3xl text-white shadow-md flex items-center justify-between"
                style={{ backgroundColor: formState.primaryColor || '#284d57' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white text-xl font-black">
                    م
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{formState.libraryName}</h3>
                    <p className="text-xs text-white/80">{formState.slogan || formState.welcomeMessage}</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-mono">
                  {formState.libraryEnglishName}
                </span>
              </div>

              {/* بطاقات تجريبية معاينة */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center space-y-1 shadow-xs">
                  <span className="font-bold text-slate-500 block">إجمالي الكتب المتاحة</span>
                  <span className="text-2xl font-black" style={{ color: formState.primaryColor || '#284d57' }}>
                    {books.length} كتاب
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center space-y-1 shadow-xs">
                  <span className="font-bold text-slate-500 block">الطلاب المسجلون</span>
                  <span className="text-2xl font-black" style={{ color: formState.secondaryColor || '#3b707d' }}>
                    {students.length} طالب
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-center space-y-1 shadow-xs">
                  <span className="font-bold text-slate-500 block">حالة المنصة</span>
                  <span className="text-sm font-black text-emerald-700 block mt-2">
                    {formState.isMaintenanceMode ? 'صيانة مؤقتة ⚠️' : 'تعمل بصورة طبيعية 🟢'}
                  </span>
                </div>
              </div>

              {/* تذييل المعاينة */}
              <div className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200">
                {formState.copyrightText || 'جميع الحقوق محفوظة'}
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsPreviewOpen(false)}>
                إغلاق المعاينة
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  handleSaveAll();
                  setIsPreviewOpen(false);
                }}
                className="bg-[#284d57] text-white font-bold"
              >
                تطبيق هذه الإعدادات رسمياً
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. نافذة تأكيد استعادة نسخة تاريخية */}
      {rollbackConfirmSnap && (
        <Modal
          isOpen={Boolean(rollbackConfirmSnap)}
          onClose={() => setRollbackConfirmSnap(null)}
          title="تأكيد استعادة نسخة إعدادات سابقة"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-slate-700" dir="rtl">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                أنت على وشك استعادة إعدادات تاريخ {formatArabicDateTime(rollbackConfirmSnap.timestamp)}.
                لن تتأثر سجلات الطلاب أو الكتب أو الإعارات الحالية مطلقاً.
              </span>
            </div>

            <p className="leading-relaxed">
              <strong>الملخص:</strong> {rollbackConfirmSnap.summary}
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setRollbackConfirmSnap(null)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirmRollback}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                تأكيد الاستعادة الآمنة
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. نافذة تأكيد استعادة الإعدادات الافتراضية */}
      {isResetConfirmOpen && (
        <Modal
          isOpen={isResetConfirmOpen}
          onClose={() => setIsResetConfirmOpen(false)}
          title="تأكيد استعادة الإعدادات الافتراضية"
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs text-slate-700" dir="rtl">
            <p className="leading-relaxed font-bold text-amber-900">
              هل أنت متأكد من رغبتك في استعادة الإعدادات الافتراضية للمكتبة؟ سيتم الاحتفاظ بكافة بيانات الطلاب والكتب.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsResetConfirmOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  resetToDefaults();
                  setIsResetConfirmOpen(false);
                  showToast('تمت استعادة الإعدادات الافتراضية بنجاح', 'success');
                }}
              >
                نعم، استعد الافتراضي
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. نافذة تأكيد تفريغ البيانات */}
      {isClearDataOpen && (
        <Modal
          isOpen={isClearDataOpen}
          onClose={() => setIsClearDataOpen(false)}
          title="تأكيد تفريغ وحذف البيانات التجريبية"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-slate-700" dir="rtl">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                تحذير: سيتم حذف الكتب والنسخ وسجلات الإعارة. تأكد من تنزيل نسخة احتياطية قبل المتابعة.
              </span>
            </div>

            <label className="flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={keepStudentsOnClear}
                onChange={(e) => setKeepStudentsOnClear(e.target.checked)}
                className="w-4 h-4 rounded text-[#284d57]"
              />
              <span>الاحتفاظ بحسابات الطلاب وعدم حذفها</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsClearDataOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  clearAllData({ keepStudents: keepStudentsOnClear });
                  setIsClearDataOpen(false);
                  showToast('تم تفريغ السجلات المحددة بنجاح', 'info');
                }}
              >
                تأكيد التفريغ
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
