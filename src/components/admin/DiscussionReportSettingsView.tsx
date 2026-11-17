import React, { useState, useEffect } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import {
  DiscussionApprovalAuthority,
  DiscussionTemplate,
  ReportExportFormat,
  ReportPeriodPreset,
} from '../../types';
import { Button } from '../common/Button';
import {
  Sliders,
  MessageSquareText,
  FileText,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  Upload,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';

export interface DiscussionReportSettingsViewProps {
  initialTab?: 'discussions' | 'reports';
}

export const DiscussionReportSettingsView: React.FC<DiscussionReportSettingsViewProps> = ({
  initialTab = 'discussions',
}) => {
  const {
    discussionSettings,
    updateDiscussionSettings,
    reportSettings,
    updateReportSettings,
  } = useLibrary();
  const { showToast } = useNotifications();

  const [activeTab, setActiveTab] = useState<'discussions' | 'reports'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Discussion Settings State
  const [discEnabled, setDiscEnabled] = useState(discussionSettings.isEnabled);
  const [templates, setTemplates] = useState<DiscussionTemplate[]>(
    discussionSettings.templates && discussionSettings.templates.length > 0
      ? discussionSettings.templates
      : [
          {
            id: 'tpl-default',
            name: 'نموذج التقييم الأساسي',
            items: discussionSettings.evaluationItems,
            totalMaxPoints: discussionSettings.totalMaxPoints,
            isDefault: true,
          },
        ]
  );
  const [activeTemplateId, setActiveTemplateId] = useState(
    discussionSettings.activeTemplateId || templates[0]?.id || 'tpl-default'
  );
  const [pointsPerDiscussion, setPointsPerDiscussion] = useState(discussionSettings.pointsPerDiscussion);
  const [pointsCalcMode, setPointsCalcMode] = useState<'fixed' | 'proportional'>(
    discussionSettings.pointsCalculationMode || 'proportional'
  );
  const [minPassingScore, setMinPassingScore] = useState(discussionSettings.minPassingScore ?? 50);
  const [allowRediscussion, setAllowRediscussion] = useState(discussionSettings.allowRediscussion);
  const [requireApproval, setRequireApproval] = useState(discussionSettings.requireApproval);
  const [approvalAuthority, setApprovalAuthority] = useState<DiscussionApprovalAuthority>(
    discussionSettings.approvalAuthority || 'supervisor_and_admin'
  );
  const [enableNotifications, setEnableNotifications] = useState(
    discussionSettings.enableNotifications !== false
  );
  const [allowIndividual, setAllowIndividual] = useState(
    discussionSettings.allowIndividualDiscussions !== false
  );
  const [allowGroup, setAllowGroup] = useState(
    discussionSettings.allowGroupDiscussions !== false
  );
  const [maxGroupSize, setMaxGroupSize] = useState(discussionSettings.maxGroupSize || 8);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Report Settings State
  const [repForm, setRepForm] = useState(reportSettings);

  useEffect(() => {
    setRepForm(reportSettings);
  }, [reportSettings]);

  const currentTemplate = templates.find((t) => t.id === activeTemplateId) || templates[0];
  const currentTotalMax = currentTemplate
    ? currentTemplate.items.reduce((sum, it) => sum + (Number(it.maxPoints) || 0), 0)
    : 100;

  const updateCurrentTemplateItems = (items: { name: string; maxPoints: number }[]) => {
    const newTotal = items.reduce((s, it) => s + (Number(it.maxPoints) || 0), 0);
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === currentTemplate?.id ? { ...t, items, totalMaxPoints: newTotal } : t
      )
    );
  };

  const handleAddEvaluationItem = () => {
    if (!currentTemplate) return;
    updateCurrentTemplateItems([
      ...currentTemplate.items,
      { name: 'عنصر تقييم جديد', maxPoints: 10 },
    ]);
  };

  const handleRemoveEvaluationItem = (idx: number) => {
    if (!currentTemplate || currentTemplate.items.length <= 1) {
      showToast('يجب الإبقاء على عنصر تقييم واحد على الأقل', 'warning');
      return;
    }
    updateCurrentTemplateItems(currentTemplate.items.filter((_, i) => i !== idx));
  };

  const handleAddTemplate = () => {
    if (!newTemplateName.trim()) {
      showToast('يرجى كتابة اسم النموذج الجديد', 'warning');
      return;
    }
    const newTpl: DiscussionTemplate = {
      id: `tpl-${Date.now()}`,
      name: newTemplateName.trim(),
      description: 'نموذج مخصص لتقييم المناقشات',
      items: currentTemplate ? [...currentTemplate.items] : [{ name: 'فهم محتوى الكتاب', maxPoints: 100 }],
      totalMaxPoints: currentTotalMax || 100,
    };
    setTemplates((prev) => [...prev, newTpl]);
    setActiveTemplateId(newTpl.id);
    setNewTemplateName('');
    showToast(`تم إنشاء النموذج "${newTpl.name}"`, 'success');
  };

  const handleSaveDiscussionSettings = () => {
    updateDiscussionSettings({
      isEnabled: discEnabled,
      evaluationItems: currentTemplate ? currentTemplate.items : discussionSettings.evaluationItems,
      totalMaxPoints: currentTotalMax || 100,
      pointsPerDiscussion: Number(pointsPerDiscussion) || 10,
      pointsCalculationMode: pointsCalcMode,
      minPassingScore: Number(minPassingScore) || 0,
      allowRediscussion,
      requireApproval,
      approvalAuthority,
      enableNotifications,
      allowIndividualDiscussions: allowIndividual,
      allowGroupDiscussions: allowGroup,
      maxGroupSize: Math.max(2, Number(maxGroupSize) || 8),
      templates,
      activeTemplateId: currentTemplate?.id,
    });
    showToast('تم حفظ إعدادات المناقشات القرائية بنجاح (مع حماية السجلات السابقة)', 'success');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showToast('حجم صورة الشعار يجب أن لا يتجاوز 1 ميجابايت', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRepForm((prev) => ({ ...prev, logoDataUrl: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveReportSettings = () => {
    updateReportSettings(repForm);
    showToast('تم حفظ إعدادات وقوالب التقارير الرسمية بنجاح! 📄', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-wathba-100 text-wathba-800">
              <Sliders className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">إعدادات التقارير والمناقشات</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            التحكم الشامل في نماذج وعناصر تقييم المناقشات، احتساب النقاط، الصلاحيات، وتصميم وترويسة وشعار التقارير الفردية والجماعية.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('discussions')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'discussions' ? 'bg-wathba-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <MessageSquareText className="w-4 h-4" />
            <span>إعدادات المناقشات</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'reports' ? 'bg-wathba-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>إعدادات التقارير</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: إعدادات المناقشات ================= */}
      {activeTab === 'discussions' && (
        <div className="space-y-6 text-xs">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>
              حماية البيانات التاريخية: أي تعديل على نماذج التقييم أو النقاط يطبق على الطلبات الجديدة فقط، ولا يحذف أو يغير أي مناقشات معتمدة أو نقاط أو شهادات سابقة.
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General Discussion Controls */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-4">
              <h3 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-2">
                التفعيل، النقاط، والصلاحيات
              </h3>

              <div className="space-y-2.5">
                {[
                  { label: 'تفعيل نظام طلب مناقشة الكتب للطلاب', val: discEnabled, set: setDiscEnabled },
                  { label: 'السماح بطلب إعادة المناقشة عند الحاجة / المبرر', val: allowRediscussion, set: setAllowRediscussion },
                  { label: 'إلزام اعتماد النتيجة قبل إضافة النقاط', val: requireApproval, set: setRequireApproval },
                  { label: 'إرسال إشعارات تلقائية عند الطلب والجدولة والاعتماد', val: enableNotifications, set: setEnableNotifications },
                  { label: 'تفعيل المناقشات الفردية', val: allowIndividual, set: setAllowIndividual },
                  { label: 'تفعيل المناقشات الجماعية (تقييم مستقل لكل طالب)', val: allowGroup, set: setAllowGroup },
                ].map((tog, i) => (
                  <label key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                    <span className="font-bold text-slate-800">{tog.label}</span>
                    <input
                      type="checkbox"
                      checked={tog.val}
                      onChange={(e) => tog.set(e.target.checked)}
                      className="w-4 h-4 rounded text-wathba-600 focus:ring-wathba-500"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">النقاط المكتسبة للمناقشة:</label>
                  <input
                    type="number"
                    min={1}
                    value={pointsPerDiscussion}
                    onChange={(e) => setPointsPerDiscussion(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">آلية احتساب النقاط:</label>
                  <select
                    value={pointsCalcMode}
                    onChange={(e) => setPointsCalcMode(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="proportional">متناسقة مع درجة الطالب من التقييم</option>
                    <option value="fixed">نقاط ثابتة عند اجتياز الحد الأدنى</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الحد الأدنى للنجاح (من {currentTotalMax}):</label>
                  <input
                    type="number"
                    min={0}
                    max={currentTotalMax}
                    value={minPassingScore}
                    onChange={(e) => setMinPassingScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الحد الأقصى لطلاب المجموعة الواحدة:</label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={maxGroupSize}
                    onChange={(e) => setMaxGroupSize(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">صلاحية اعتماد المناقشة وإضافة النقاط:</label>
                <select
                  value={approvalAuthority}
                  onChange={(e) => setApprovalAuthority(e.target.value as DiscussionApprovalAuthority)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  <option value="supervisor_and_admin">المدير والمشرفون المخوّلون</option>
                  <option value="designated_supervisors">المشرفون أصحاب صلاحية «اعتماد النقاط» والمدير فقط</option>
                  <option value="admin_only">المدير العام فقط (المشرف يسجل النتيجة والمدير يعتمدها)</option>
                </select>
              </div>
            </div>

            {/* Templates & Evaluation Elements */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-black text-sm text-slate-900">نماذج وعناصر تقييم المناقشات</h3>
                <span className="px-3 py-1 rounded-xl bg-wathba-700 text-white font-black">
                  الدرجة النهائية: {currentTotalMax}
                </span>
              </div>

              {/* Template Selector & Creator */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="font-bold text-slate-700 block">النموذج النشط حالياً:</label>
                <select
                  value={currentTemplate?.id}
                  onChange={(e) => setActiveTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.totalMaxPoints} درجة)
                    </option>
                  ))}
                </select>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="اسم نموذج جديد (مثال: تقييم المرحلة العليا)..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                  />
                  <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddTemplate}>
                    إنشاء نموذج
                  </Button>
                </div>
              </div>

              {/* Elements Editor */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">عناصر التقييم وأوزانها:</span>
                  <button
                    type="button"
                    onClick={handleAddEvaluationItem}
                    className="text-wathba-700 font-black hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة عنصر</span>
                  </button>
                </div>

                {currentTemplate?.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const updated = currentTemplate.items.map((it, i) =>
                          i === idx ? { ...it, name: e.target.value } : it
                        );
                        updateCurrentTemplateItems(updated);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                    />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={item.maxPoints}
                      onChange={(e) => {
                        const updated = currentTemplate.items.map((it, i) =>
                          i === idx ? { ...it, maxPoints: Math.max(1, Number(e.target.value) || 0) } : it
                        );
                        updateCurrentTemplateItems(updated);
                      }}
                      className="w-20 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-black text-center font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveEvaluationItem(idx)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                      title="حذف العنصر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <Button variant="primary" size="md" icon={<Save className="w-4 h-4" />} onClick={handleSaveDiscussionSettings}>
                  حفظ إعدادات المناقشات
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: إعدادات التقارير ================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branding, Header & Signatures */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-4">
              <h3 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-2">
                الشعار، الترويسة، والتوقيعات الرسمية
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم الجهة المصدرة للتقارير:</label>
                  <input
                    type="text"
                    value={repForm.issuerOrganization}
                    onChange={(e) => setRepForm({ ...repForm, issuerOrganization: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">عنوان الترويسة الفرعي:</label>
                  <input
                    type="text"
                    value={repForm.reportHeaderTitle}
                    onChange={(e) => setRepForm({ ...repForm, reportHeaderTitle: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>

                {/* Logo Upload */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-wathba-600" />
                      <span>شعار مكتبة وثبة في التقارير</span>
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={repForm.showLogo}
                        onChange={(e) => setRepForm({ ...repForm, showLogo: e.target.checked })}
                        className="rounded text-wathba-600"
                      />
                      <span className="font-bold">إظهار الشعار</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    {repForm.logoDataUrl ? (
                      <img
                        src={repForm.logoDataUrl}
                        alt="شعار التقرير"
                        className="w-14 h-14 object-contain rounded-xl border border-slate-300 bg-white p-1"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#3b707d] text-white font-black flex items-center justify-center border-2 border-gold-400">
                        وثبة
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 font-bold cursor-pointer hover:bg-slate-100 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>رفع شعار مخصص</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      {repForm.logoDataUrl && (
                        <button
                          type="button"
                          onClick={() => setRepForm({ ...repForm, logoDataUrl: undefined })}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-bold"
                        >
                          استعادة الشعار الافتراضي
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">المسمى الوظيفي للموقع:</label>
                    <input
                      type="text"
                      value={repForm.signatoryTitle}
                      onChange={(e) => setRepForm({ ...repForm, signatoryTitle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">اسم المسؤول / الجهة الموقعة:</label>
                    <input
                      type="text"
                      value={repForm.signatoryName}
                      onChange={(e) => setRepForm({ ...repForm, signatoryName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">تسمية توقيع المشرف:</label>
                    <input
                      type="text"
                      value={repForm.supervisorSignatureLabel}
                      onChange={(e) => setRepForm({ ...repForm, supervisorSignatureLabel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">تسمية اعتماد الإدارة:</label>
                    <input
                      type="text"
                      value={repForm.adminSignatureLabel}
                      onChange={(e) => setRepForm({ ...repForm, adminSignatureLabel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">نص تذييل التقارير:</label>
                  <input
                    type="text"
                    value={repForm.footerText}
                    onChange={(e) => setRepForm({ ...repForm, footerText: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={repForm.showSignatures}
                    onChange={(e) => setRepForm({ ...repForm, showSignatures: e.target.checked })}
                    className="rounded text-wathba-600"
                  />
                  <span className="font-bold text-slate-800">إظهار خانات التوقيعات والاعتماد أسفل التقرير</span>
                </label>
              </div>
            </div>

            {/* Template Sections & Defaults */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-5">
              <h3 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-2">
                تخصيص قوالب التقارير والفترات الافتراضية
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">الفترة الزمنية الافتراضية:</label>
                  <select
                    value={repForm.defaultPeriod}
                    onChange={(e) => setRepForm({ ...repForm, defaultPeriod: e.target.value as ReportPeriodPreset })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="all">جميع الفترات</option>
                    <option value="this_week">هذا الأسبوع</option>
                    <option value="this_month">هذا الشهر</option>
                    <option value="last_30_days">آخر 30 يوماً</option>
                    <option value="this_term">الفصل الدراسي</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">صيغة التصدير الافتراضية:</label>
                  <select
                    value={repForm.defaultFormat}
                    onChange={(e) => setRepForm({ ...repForm, defaultFormat: e.target.value as ReportExportFormat })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="pdf">PDF رسمي</option>
                    <option value="excel">Excel (XLSX)</option>
                    <option value="print">طباعة مباشرة</option>
                  </select>
                </div>
              </div>

              {/* Group Sections */}
              <div className="space-y-2">
                <span className="font-black text-slate-800 block">أقسام قالب «تقرير المجموعة»:</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'groupInfo', label: 'بيانات المجموعة الأساسية' },
                    { key: 'readingStats', label: 'إحصائيات القراءة والمناقشات' },
                    { key: 'studentsTable', label: 'جدول تفاصيل الطلاب' },
                    { key: 'performanceAnalysis', label: 'تحليل أداء المجموعة' },
                    { key: 'charts', label: 'الرسوم البيانية' },
                    { key: 'supervisorSummary', label: 'ملخص وتوصيات المشرف' },
                  ].map((s) => (
                    <label key={s.key} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(repForm.groupSections as any)[s.key]}
                        onChange={(e) =>
                          setRepForm({
                            ...repForm,
                            groupSections: { ...repForm.groupSections, [s.key]: e.target.checked },
                          })
                        }
                        className="rounded text-wathba-600"
                      />
                      <span className="font-bold text-slate-700">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Student Sections */}
              <div className="space-y-2">
                <span className="font-black text-slate-800 block">أقسام قالب «التقرير الفردي للطالب»:</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'studentInfo', label: 'بيانات الطالب الأساسية' },
                    { key: 'achievementSummary', label: 'ملخص الإنجازات' },
                    { key: 'booksLog', label: 'سجل الكتب المستعارة' },
                    { key: 'readingLog', label: 'سجل القراءة والصفحات' },
                    { key: 'discussionsLog', label: 'سجل المناقشات' },
                    { key: 'progressCharts', label: 'رسوم تحليل التقدم' },
                    { key: 'supervisorNotes', label: 'ملاحظات وتوصيات المشرف' },
                  ].map((s) => (
                    <label key={s.key} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(repForm.studentSections as any)[s.key]}
                        onChange={(e) =>
                          setRepForm({
                            ...repForm,
                            studentSections: { ...repForm.studentSections, [s.key]: e.target.checked },
                          })
                        }
                        className="rounded text-wathba-600"
                      />
                      <span className="font-bold text-slate-700">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <Button variant="primary" size="md" icon={<CheckCircle2 className="w-4 h-4" />} onClick={handleSaveReportSettings}>
                  حفظ إعدادات التقارير
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
