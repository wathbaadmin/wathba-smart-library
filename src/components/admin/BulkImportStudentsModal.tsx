import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { EphemeralStudentCredential, Student } from '../../types';
import {
  parseStudentExcel,
  convertRowsToStudentsWithCredentials,
  ParsedStudentRow,
} from '../../lib/excelImporter';
import { useLibrary } from '../../context/LibraryContext';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface BulkImportStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCount?: number;
  onConfirmImport: (students: Student[], credentials?: EphemeralStudentCredential[]) => void;
}

export const BulkImportStudentsModal: React.FC<BulkImportStudentsModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
}) => {
  const { students } = useLibrary();
  const [parsedRows, setParsedRows] = useState<ParsedStudentRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    setError(null);

    try {
      const rows = await parseStudentExcel(file);
      if (rows.length === 0) {
        setError('لم يتم العثور على سجلات صالحة للطلاب في الملف المرفوع');
      } else {
        setParsedRows(rows);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء قراءة ملف Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;
    const { students: finalStudents, credentials } = convertRowsToStudentsWithCredentials(
      parsedRows,
      students
    );
    onConfirmImport(finalStudents, credentials);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="استيراد قائمة الطلاب من ملف Excel دفعة واحدة"
      subtitle="يدعم ملفات XLSX و CSV مع توليد رموز الدخول والـ QR تلقائياً"
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Drop Zone */}
        <div className="border-2 border-dashed border-slate-300 hover:border-wathba-500 rounded-2xl p-6 text-center bg-slate-50 hover:bg-wathba-50/40 transition-colors">
          <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-slate-800">
            {fileName ? `الملف المختار: ${fileName}` : 'اختر ملف Excel أو اسحبه إلى هنا'}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            يجب أن يتضمن الملف أعمدة: <strong>الاسم، الصف، المرحلة، المجموعة</strong>
          </p>

          <label className="mt-4 inline-block">
            <span className="px-4 py-2 rounded-xl bg-wathba-600 text-white text-xs font-bold hover:bg-wathba-700 cursor-pointer shadow-soft transition-colors">
              تصفح الملفات
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Table */}
        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>معاينة البيانات المستخرجة:</span>
              <span className="text-emerald-700 font-bold">
                {parsedRows.length} طالب جاهز للاستيراد
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">الاسم</th>
                    <th className="p-2.5">الصف</th>
                    <th className="p-2.5">المرحلة</th>
                    <th className="p-2.5">المجموعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="p-2.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="p-2.5 font-bold text-slate-800">{r.fullName}</td>
                      <td className="p-2.5 text-slate-600">{r.grade}</td>
                      <td className="p-2.5 text-slate-600">{r.stage}</td>
                      <td className="p-2.5 text-slate-600">{r.groupName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={parsedRows.length === 0}
            onClick={handleExecuteImport}
            icon={<CheckCircle className="w-4 h-4" />}
          >
            تأكيد استيراد {parsedRows.length} طالب الآن
          </Button>
        </div>
      </div>
    </Modal>
  );
};
