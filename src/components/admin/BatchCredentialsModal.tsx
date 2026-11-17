import React, { useState, useMemo } from 'react';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { EphemeralStudentCredential } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { StudentCredentialsPrintSheet } from './StudentCredentialsPrintSheet';
import {
  KeyRound,
  Search,
  Users,
  CheckSquare,
  Square,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface BatchCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchCredentialsModal: React.FC<BatchCredentialsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentStaff } = useAuth();
  const { students, batchGenerateStudentCredentials, issuedStudentCredentials } = useLibrary();
  const { showToast } = useNotifications();

  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [regenerateCodes, setRegenerateCodes] = useState(false);
  const [generatedList, setGeneratedList] = useState<EphemeralStudentCredential[] | null>(null);

  const groups = useMemo(
    () => Array.from(new Set(students.map((s) => s.groupName).filter(Boolean))),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      const matchSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.internalId.toLowerCase().includes(q) ||
        s.groupName.toLowerCase().includes(q);
      const matchGroup = groupFilter === 'all' || s.groupName === groupFilter;
      return matchSearch && matchGroup;
    });
  }, [students, searchTerm, groupFilter]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    const allSelected = allFilteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleGenerate = () => {
    if (selectedIds.length === 0) {
      showToast('يرجى تحديد طالب واحد على الأقل أولاً', 'warning');
      return;
    }

    const res = batchGenerateStudentCredentials({
      studentIds: selectedIds,
      regenerateStudentCodes: regenerateCodes,
      staffId: currentStaff?.id,
    });

    if (res.success) {
      setGeneratedList(res.credentials);
      showToast(
        `تم إنشاء وتحديث بيانات الدخول المشفرة لـ ${res.credentials.length} طالب بنجاح`,
        'success'
      );
    }
  };

  const handleCloseReset = () => {
    setGeneratedList(null);
    setSelectedIds([]);
    setRegenerateCodes(false);
    onClose();
  };

  const credMapForPrint = useMemo(() => {
    const map: Record<string, EphemeralStudentCredential> = { ...issuedStudentCredentials };
    (generatedList || []).forEach((c) => {
      map[c.studentId] = c;
    });
    return map;
  }, [generatedList, issuedStudentCredentials]);

  const generatedStudentObjects = useMemo(() => {
    if (!generatedList) return [];
    const ids = new Set(generatedList.map((g) => g.studentId));
    return students.filter((s) => ids.has(s.id));
  }, [generatedList, students]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseReset}
      title="إنشاء وإصدار بيانات الدخول لعدة طلاب دفعة واحدة"
      subtitle="توليد رموز دخول مشفرة وتجهيز بطاقات التسليم والطباعة الجماعية بأمان"
      maxWidth="4xl"
    >
      {generatedList ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-black">
                تم توليد وتشفير بيانات الدخول لـ ({generatedList.length}) طالب!
              </strong>
              <span>
                حُفظت التجزئة الآمنة في النظام، ويمكنك الآن طباعة البطاقات أو نسخ الأكواد مباشرة قبل إغلاق هذه النافذة.
              </span>
            </div>
          </div>

          <StudentCredentialsPrintSheet
            students={generatedStudentObjects}
            credentialsMap={credMapForPrint}
            onClose={handleCloseReset}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#f6f8fa] border border-[#dde6ed] flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث بالاسم أو كود الطالب..."
                className="w-full min-h-[42px] pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-[#3b707d] outline-none"
              />
            </div>

            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full sm:w-auto min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
            >
              <option value="all">جميع المجموعات</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            <Button variant="secondary" size="sm" onClick={selectAllFiltered} className="w-full sm:w-auto">
              تحديد / إلغاء المصفّى ({filteredStudents.length})
            </Button>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer">
            <input
              type="checkbox"
              checked={regenerateCodes}
              onChange={(e) => setRegenerateCodes(e.target.checked)}
              className="w-4 h-4 rounded text-[#3b707d]"
            />
            <span>إعادة توليد «كود الطالب» أيضاً (إذا لم يُحدد، سيُحدّث رمز الدخول فقط مع الإبقاء على كود الطالب الحالي)</span>
          </label>

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {filteredStudents.map((s) => {
              const checked = selectedIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => toggleStudent(s.id)}
                  className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    checked ? 'bg-[#e3ecf3]/55' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-[#3b707d] shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 truncate">{s.fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        {s.grade} • {s.groupName}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-black text-[#284d57] bg-[#f6f8fa] px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                    {s.internalId}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#3b707d]" />
              <span>تم تحديد {selectedIds.length} طالب</span>
            </span>

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <Button variant="secondary" size="md" onClick={handleCloseReset}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={selectedIds.length === 0}
                icon={<Sparkles className="w-4 h-4" />}
                onClick={handleGenerate}
              >
                توليد بيانات الدخول لـ ({selectedIds.length}) طالب
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
