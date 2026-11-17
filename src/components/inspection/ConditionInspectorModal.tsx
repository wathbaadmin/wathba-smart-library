import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ConditionRating, BookCopy, Student } from '../../types';
import { Camera, Image as ImageIcon, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { uploadConditionPhoto } from '../../lib/storage';

interface ConditionInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  copy: BookCopy;
  student?: Student;
  stage: 'checkout' | 'return';
  onConfirm: (data: {
    rating: ConditionRating;
    notes: string;
    photos: string[];
  }) => void;
}

export const ConditionInspectorModal: React.FC<ConditionInspectorModalProps> = ({
  isOpen,
  onClose,
  copy,
  student,
  stage,
  onConfirm,
}) => {
  const [rating, setRating] = useState<ConditionRating>(stage === 'return' ? 'good' : 'pristine');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const files = Array.from(e.target.files);
      for (const file of files) {
        const url = await uploadConditionPhoto(file, `inspect_${copy.copyCode}`);
        setPhotos((prev) => [...prev, url]);
      }
    } catch (err) {
      console.error('Error uploading photos:', err);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      rating,
      notes,
      photos,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={stage === 'checkout' ? 'توثيق حالة النسخة قبل التسليم' : 'فحص وتوثيق حالة النسخة عند الاسترجاع'}
      subtitle={`النسخة: ${copy.copyCode} ${student ? `• الطالب: ${student.fullName}` : ''}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating Options */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            نتيجة فحص الكتاب:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setRating('pristine')}
              className={`p-3 rounded-xl border text-center transition-all ${
                rating === 'pristine'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold ring-2 ring-emerald-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">✨ ممتاز وجديد</div>
              <div className="text-[10px] text-slate-500 mt-0.5">لا توجد أي خدوش</div>
            </button>

            <button
              type="button"
              onClick={() => setRating('good')}
              className={`p-3 rounded-xl border text-center transition-all ${
                rating === 'good'
                  ? 'bg-teal-50 border-teal-500 text-teal-800 font-bold ring-2 ring-teal-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">👍 سليم ونظيف</div>
              <div className="text-[10px] text-slate-500 mt-0.5">استخدام طبيعي نظيف</div>
            </button>

            <button
              type="button"
              onClick={() => setRating('needs_monitoring')}
              className={`p-3 rounded-xl border text-center transition-all ${
                rating === 'needs_monitoring'
                  ? 'bg-amber-50 border-amber-500 text-amber-800 font-bold ring-2 ring-amber-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">⚠️ يحتاج متابعة</div>
              <div className="text-[10px] text-slate-500 mt-0.5">ثني أوراق أو غلاف مفكك</div>
            </button>

            <button
              type="button"
              onClick={() => setRating('damaged')}
              className={`p-3 rounded-xl border text-center transition-all ${
                rating === 'damaged'
                  ? 'bg-rose-50 border-rose-500 text-rose-800 font-bold ring-2 ring-rose-400'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">❌ متضرر / تالف</div>
              <div className="text-[10px] text-slate-500 mt-0.5">تمزيق، بقع، كتابة على النص</div>
            </button>
          </div>
        </div>

        {/* Written notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            ملاحظات الفحص التفصيلية:
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اكتب أي ملاحظة عن حالة الغلاف، الصفحات الداخلية، أو موضع التلف إن وجد..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-wathba-500 focus:outline-none"
          />
        </div>

        {/* Photos Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-700">
              توثيق الصور (الغلاف، الصفحات، أو مواضع التلف):
            </label>
            <span className="text-[11px] text-slate-400">
              {photos.length} صور محفوظة
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {photos.map((url, idx) => (
              <div
                key={idx}
                className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group bg-slate-100"
              >
                <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute inset-0 bg-rose-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-wathba-500 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 hover:bg-wathba-50/50">
              <Camera className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] text-slate-500 mt-1">
                {uploading ? 'جارٍ الحفظ...' : 'إضافة صورة'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="md" onClick={onClose} type="button">
            إلغاء
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            icon={<CheckCircle className="w-4 h-4" />}
          >
            {stage === 'checkout' ? 'اعتماد الفحص وإتمام التسليم' : 'اعتماد نتيجة الفحص والاسترجاع'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
