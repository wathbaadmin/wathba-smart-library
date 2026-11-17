import React from 'react';
import {
  ReadingCertificate,
  ReadingRankDefinition,
  StudentRankAchievement,
} from '../../../types';
import { useLibrary } from '../../../context/LibraryContext';
import { formatUmmAlQuraDate } from '../../../lib/dateUtils';
import { Modal } from '../../common/Modal';
import { Button } from '../../common/Button';
import { RankEmblem } from './RankEmblem';
import { Crown, Sparkles, Award, ScrollText } from 'lucide-react';

interface RankCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  achievement: StudentRankAchievement;
  rank: ReadingRankDefinition;
  certificate?: ReadingCertificate;
  onViewCertificate: (cert: ReadingCertificate) => void;
}

export const RankCelebrationModal: React.FC<RankCelebrationModalProps> = ({
  isOpen,
  onClose,
  studentId,
  achievement,
  rank,
  certificate,
  onViewCertificate,
}) => {
  const { markRankCelebrated } = useLibrary();

  const isWathab = rank.isHighestTier || rank.themeKey === 'wathab';

  const handleConfirm = () => {
    markRankCelebrated(studentId, rank.id);
    onClose();
  };

  const handleOpenCert = () => {
    markRankCelebrated(studentId, rank.id);
    onClose();
    if (certificate) onViewCertificate(certificate);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleConfirm}
      title={
        isWathab
          ? `تتويج أسطوري! بلغتَ قمة المكتبة بلقب «${rank.title}» 👑`
          : `مبارك! حصلت على لقب «${rank.title}» 🎉`
      }
      subtitle={`تاريخ الاستحقاق: ${formatUmmAlQuraDate(achievement.unlockedAt)}`}
      maxWidth="md"
    >
      <div className="space-y-5 text-center">
        {/* بانر الاحتفال */}
        <div
          className={`p-6 rounded-3xl relative overflow-hidden space-y-4 ${
            isWathab
              ? 'bg-gradient-to-br from-[#162b31] via-[#27434b] to-[#78350f] text-white border-2 border-gold-400 shadow-premium'
              : 'bg-gradient-to-br from-wathba-800 to-wathba-600 text-white shadow-soft'
          }`}
        >
          <div className="flex justify-center">
            <RankEmblem
              themeKey={rank.themeKey}
              primaryColor={rank.primaryColor}
              accentColor={rank.accentColor}
              status="earned"
              size="lg"
            />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/25 text-[11px] font-bold text-gold-300">
              {isWathab ? (
                <>
                  <Crown className="w-3.5 h-3.5" />
                  <span>التصنيف الأعلى في مكتبة وثبة الذكية</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>رتبة قرائية جديدة معتمدة</span>
                </>
              )}
            </div>

            <h3 className="text-2xl font-black text-white">{rank.title}</h3>
            <p className="text-xs text-wathba-100 leading-relaxed max-w-sm mx-auto">
              {rank.motivationalPhrase}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-black/25 border border-white/15 text-xs font-bold">
            <span>إجمالي صفحاتك المعتمدة:</span>
            <strong className="text-gold-300">
              {achievement.pagesAtAchievement.toLocaleString('ar-SA')} صفحة
            </strong>
          </div>
        </div>

        {/* وسام وثّاب الرقمي الحصري إذا وصل للقمة */}
        {isWathab && (
          <div className="p-4 rounded-2xl bg-gradient-to-l from-amber-50 to-yellow-50 border-2 border-gold-400 flex items-center gap-3.5 text-right shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gold-600 to-amber-300 text-slate-950 flex items-center justify-center shrink-0 shadow-soft">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                وسام رقمي حصري للمرتبة العليا
              </span>
              <h4 className="font-black text-sm text-slate-900">
                {rank.badgeTitle || 'الوسام الذهبي الحصري «وثّاب»'}
              </h4>
              <p className="text-[11px] text-slate-600">
                أُضيف هذا الوسام الفريد إلى ملف إنجازاتك ولا يتوفر إلا لمن أتمّ {rank.requiredPages.toLocaleString('ar-SA')} صفحة!
              </p>
            </div>
          </div>
        )}

        {/* أزرار عرض الشهادة أو المتابعة */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          {certificate && (
            <Button
              variant="primary"
              size="lg"
              onClick={handleOpenCert}
              icon={<ScrollText className="w-4 h-4" />}
              className="w-full sm:w-auto bg-gold-500 hover:bg-gold-400 text-slate-950 font-black"
            >
              عرض وتنزيل الشهادة الرسمية 📜
            </Button>
          )}
          <Button
            variant="secondary"
            size="lg"
            onClick={handleConfirm}
            className="w-full sm:w-auto font-bold"
          >
            الاستمرار في مكتبتي
          </Button>
        </div>
      </div>
    </Modal>
  );
};
