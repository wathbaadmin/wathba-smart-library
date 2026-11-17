import React from 'react';
import { Modal } from '../common/Modal';
import { ConditionReport, BookCopy, Book } from '../../types';
import { Badge } from '../common/Badge';
import { formatArabicDateTime } from '../../lib/dateUtils';
import { ShieldAlert, CheckCircle2, Calendar, User } from 'lucide-react';

interface InspectionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  copy: BookCopy;
  book?: Book;
  reports: ConditionReport[];
}

export const InspectionHistoryModal: React.FC<InspectionHistoryModalProps> = ({
  isOpen,
  onClose,
  copy,
  book,
  reports,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="سجل الفحص والحماية التاريخي للكتاب"
      subtitle={`النسخة: ${copy.copyCode} • ${book?.title || ''}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            لا توجد تقارير فحص سابقة مسجلة لهذه النسخة حتى الآن
          </div>
        ) : (
          <div className="relative border-r-2 border-slate-200 mr-4 pr-6 space-y-6">
            {reports.map((report) => (
              <div key={report.id} className="relative group">
                {/* Timeline Node */}
                <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-white border-4 border-wathba-600 shadow-xs"></div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">
                        {report.stage === 'checkout'
                          ? 'فحص عند التسليم للطالب'
                          : report.stage === 'return'
                          ? 'فحص عند الاسترجاع'
                          : 'فحص دوري'}
                      </span>
                      <Badge status={report.rating} size="sm" />
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {formatArabicDateTime(report.createdAt)}
                    </span>
                  </div>

                  {report.details && (
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      {report.details}
                    </p>
                  )}

                  {/* Photos */}
                  {report.photos && report.photos.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 mb-1.5">
                        الصور الموثقة في هذا الفحص:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {report.photos.map((photo, pIdx) => (
                          <a
                            key={pIdx}
                            href={photo.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-20 h-20 rounded-xl overflow-hidden border border-slate-200 hover:border-wathba-500 transition-colors shadow-xs"
                          >
                            <img
                              src={photo.photoUrl}
                              alt={`Documentation ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
