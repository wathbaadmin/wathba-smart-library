import React, { useState } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { formatArabicDate } from '../../lib/dateUtils';
import {
  Bell,
  Send,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  User,
  Users,
  Megaphone,
  Sparkles,
} from 'lucide-react';

export const NotificationsManager: React.FC = () => {
  const { students, loans, copies, books } = useLibrary();
  const { notifications, markAsRead, markAllAsRead, showToast, addNotification } = useNotifications();
  const { currentStaff } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // New Broadcast Notification Form
  const [targetGroup, setTargetGroup] = useState<'all' | 'specific_student'>('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifPriority, setNotifPriority] = useState<'info' | 'warning' | 'urgent'>('info');

  // Automated overdue loan alerts calculation
  const overdueLoans = loans.filter((l) => {
    if (l.status !== 'active') return false;
    return new Date().getTime() > new Date(l.dueDate).getTime();
  });

  const handleSendNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) {
      showToast('يرجى ملء عنوان ونص الإشعار', 'warning');
      return;
    }
    if (targetGroup === 'specific_student' && !selectedStudentId) {
      showToast('يرجى اختيار الطالب المستهدف', 'warning');
      return;
    }

    addNotification({
      recipientType: targetGroup === 'all' ? 'broadcast' : 'student',
      studentId: targetGroup === 'specific_student' ? selectedStudentId : undefined,
      title: notifTitle.trim(),
      message: notifMessage.trim(),
      type: notifPriority,
    });

    showToast(
      targetGroup === 'all'
        ? 'تم إرسال التعميم الإداري لجميع الطلاب بنجاح 📢'
        : 'تم إرسال الإشعار المباشر للطالب بنجاح 📨',
      'success'
    );

    setNotifTitle('');
    setNotifMessage('');
    setSelectedStudentId('');
    setIsComposeOpen(false);
  };

  const filteredNotifications = notifications.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || n.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-soft flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-wathba-100 text-wathba-700">
              <Bell className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-900">مركز الإشعارات والتعميمات الذكية</h2>
          </div>
          <p className="text-xs text-slate-500">
            إدارة تنبيهات مواعيد الإرجاع، الإشعارات التلقائية للكتب المتأخرة، وإرسال التعميمات للطلاب.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button
            variant="primary"
            size="md"
            icon={<Megaphone className="w-4 h-4" />}
            onClick={() => setIsComposeOpen(!isComposeOpen)}
            className="w-full md:w-auto text-xs font-bold"
          >
            {isComposeOpen ? 'إغلاق نافذة الإرسال' : 'إرسال تعميم جديد'}
          </Button>

          {notifications.some((n) => !n.isRead) && (
            <Button
              variant="secondary"
              size="md"
              onClick={markAllAsRead}
              className="text-xs font-bold whitespace-nowrap"
            >
              تحديد الكل كمقروء
            </Button>
          )}
        </div>
      </div>

      {/* Overdue Alert Banner if any */}
      {overdueLoans.length > 0 && (
        <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-900 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-right">
              <span className="font-black text-xs block">
                تنبيه نظام الإعارات: يوجد {overdueLoans.length} كتاب متأخر عن موعد الإرجاع
              </span>
              <span className="text-[11px] text-rose-700">
                يقوم النظام بإرسال تنبيهات تلقائية للطلاب لتسليم الكتب إلى مقر المكتبة.
              </span>
            </div>
          </div>
          <div className="text-xs font-bold px-3 py-1 bg-white rounded-xl border border-rose-200 text-rose-700">
            إشعار آلي نشط
          </div>
        </div>
      )}

      {/* Compose Form Modal / Dropdown */}
      {isComposeOpen && (
        <div className="bg-white p-6 rounded-3xl border-2 border-wathba-500 shadow-card animate-in fade-in duration-200 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-wathba-600" />
              <span>إنشاء إشعار / تعميم جديد</span>
            </h3>
            <span className="text-[11px] text-slate-400">بصوت إدارة مكتبة وثبة الذكية</span>
          </div>

          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">جهة الاستقبال:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetGroup('all')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      targetGroup === 'all'
                        ? 'border-wathba-600 bg-wathba-50 text-wathba-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>جميع الطلاب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetGroup('specific_student')}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      targetGroup === 'specific_student'
                        ? 'border-wathba-600 bg-wathba-50 text-wathba-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span>طالب محدد</span>
                  </button>
                </div>
              </div>

              {targetGroup === 'specific_student' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">اختر الطالب:</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-wathba-500"
                  >
                    <option value="">-- اضغط للاختيار --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.grade} - {st.groupName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">نوع الإشعار وأهميته:</label>
                <select
                  value={notifPriority}
                  onChange={(e) => setNotifPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-wathba-500"
                >
                  <option value="info">إرشادي عام (Info)</option>
                  <option value="warning">تذكير بموعد (Warning)</option>
                  <option value="urgent">عاجل وهام (Urgent)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">عنوان الإشعار:</label>
              <input
                type="text"
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
                placeholder="مثال: بدء تحدي القراءة الأسبوعي لمكتبة وثبة 🏆"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-wathba-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">نص الرسالة / التعميم:</label>
              <textarea
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                rows={3}
                placeholder="اكتب التوجيهات أو التنبيهات الموجهة للطلاب هنا..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-wathba-500"
              ></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsComposeOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon={<Send className="w-4 h-4" />}
                className="text-xs font-bold"
              >
                إرسال الإشعار الآن
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في سجل الإشعارات..."
            className="w-full pr-10 pl-3 py-2 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-wathba-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs font-bold rounded-2xl border border-slate-200 bg-white focus:outline-none"
          >
            <option value="all">جميع الأنواع</option>
            <option value="info">إرشادي عام</option>
            <option value="warning">تنبيهات المواعيد</option>
            <option value="urgent">عاجل</option>
          </select>
        </div>
      </div>

      {/* Notifications History List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 text-xs">
            لا توجد إشعارات مسجلة تطابق البحث
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isUnread = !notif.isRead;
            return (
              <div
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isUnread
                    ? 'bg-wathba-50/50 border-wathba-200 shadow-soft'
                    : 'bg-white border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-2xl shrink-0 mt-0.5 ${
                      notif.type === 'urgent'
                        ? 'bg-rose-100 text-rose-700'
                        : notif.type === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-wathba-100 text-wathba-700'
                    }`}
                  >
                    {notif.type === 'urgent' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : notif.type === 'warning' ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <Info className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1 text-right">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-slate-900">{notif.title}</h4>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-wathba-600 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
                    <span className="text-[10px] text-slate-400 block pt-1 font-mono">
                      {formatArabicDate(notif.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      notif.recipientType === 'broadcast'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {notif.recipientType === 'broadcast' ? 'تعميم عام' : 'طالب محدد'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isUnread ? 'اضغط للتحديد كمقروء' : 'تم الاطلاع'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
