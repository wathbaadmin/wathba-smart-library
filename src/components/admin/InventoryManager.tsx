import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { InventorySession } from '../../types';
import { InventorySessionView } from './InventorySessionView';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ClipboardCheck, Plus, CheckCircle, ArrowLeft, History, Play } from 'lucide-react';
import { formatArabicDateTime } from '../../lib/dateUtils';

export const InventoryManager: React.FC = () => {
  const { inventorySessions, createInventorySession } = useLibrary();
  const { currentStaff } = useAuth();
  const { showToast } = useNotifications();

  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState(
    `جرد المكتبة الفصلي - ${new Date().toLocaleDateString('ar-SA')}`
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionTitle.trim() || !currentStaff) return;

    const newSession = createInventorySession(sessionTitle.trim(), currentStaff.id);
    showToast('تم بدء جلسة الجرد بنجاح!', 'success');
    setCreateModalOpen(false);
    setActiveSession(newSession);
  };

  if (activeSession) {
    return (
      <InventorySessionView
        session={activeSession}
        onBack={() => setActiveSession(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-soft flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-slate-900">
              نظام الجرد الدوري والميداني (Inventory Sessions)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            إنشاء جلسات جرد، مسح ملصقات الكتب على الرفوف، المقارنة التلقائية مع قاعدة البيانات لاكتشاف المفقودات وحفظ السجل التاريخي.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateModalOpen(true)}
        >
          بدء جلسة جرد جديدة
        </Button>
      </div>

      {/* Sessions History List */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-soft">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
            <History className="w-4 h-4 text-purple-600" />
            سجل جلسات الجرد الموثقة
          </span>
          <span className="text-xs text-slate-400 font-bold">
            {inventorySessions.length} جلسة مسجلة
          </span>
        </div>

        {inventorySessions.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            لم يتم إنشاء أي جلسة جرد حتى الآن. اضغط على «بدء جلسة جرد جديدة» لمسح الرفوف.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inventorySessions.map((session) => (
              <div
                key={session.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900">{session.title}</h4>
                    <Badge status={session.status} size="sm" />
                  </div>
                  <div className="text-slate-500 flex items-center gap-3">
                    <span>بدأت: {formatArabicDateTime(session.startedAt)}</span>
                    {session.completedAt && (
                      <span>• اكتملت: {formatArabicDateTime(session.completedAt)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right sm:text-left text-xs">
                    <span className="text-slate-400 block text-[10px]">النسخ التي تم مسحها</span>
                    <strong className="text-emerald-700 font-bold text-sm">
                      {session.scannedCopiesCount} من {session.expectedCopiesCount}
                    </strong>
                  </div>

                  <Button
                    variant={session.status === 'active' ? 'primary' : 'secondary'}
                    size="sm"
                    icon={<Play className="w-3.5 h-3.5" />}
                    onClick={() => setActiveSession(session)}
                  >
                    {session.status === 'active' ? 'متابعة المسح' : 'عرض التقرير'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start Session Modal */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="بدء جلسة جرد رفوف جديدة"
          maxWidth="md"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان أو مسمى جلسة الجرد: *
              </label>
              <input
                type="text"
                required
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="مثال: جرد الكتب الإسلامية - الفصل الأول"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-wathba-500"
              />
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 leading-relaxed">
              💡 ستقوم الجلسة بجلب إجمالي النسخ الحالية ومقارنتها تلقائياً بالنسخ الممسوحة مع تمييز الكتب المستعارة.
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="secondary" size="md" onClick={() => setCreateModalOpen(false)}>
                إلغاء
              </Button>
              <Button variant="primary" size="md" type="submit">
                بدء الجرد الآن
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
