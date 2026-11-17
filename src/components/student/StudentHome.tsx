import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { ReadingChallengeCard } from './ReadingChallengeCard';
import { BookCatalog } from './BookCatalog';
import { MyBooks } from './MyBooks';
import { QRCodeView } from '../qr/QRCodeView';
import { Button } from '../common/Button';
import { BookOpen, BookMarked, Sparkles, QrCode, Trophy, Award, HeartHandshake } from 'lucide-react';

export const StudentHome: React.FC = () => {
  const { currentStudent } = useAuth();
  const { books, readingChallenges, getStudentActiveLoans } = useLibrary();
  const [activeTab, setActiveTab] = useState<'catalog' | 'my-books'>('catalog');
  const [showQRModal, setShowQRModal] = useState(false);

  if (!currentStudent) return null;

  const currentChallenge = readingChallenges.find((c) => c.isActive) || readingChallenges[0];
  const bookOfTheWeek = books.find((b) => b.isBookOfTheWeek) || books[0];
  const activeLoans = getStudentActiveLoans(currentStudent.id);

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Welcome Banner */}
      <div className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-soft flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-gold-500" />
            <span>مرحباً ببطل القراءة في مكتبة وثبة الذكية!</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            أهلاً بك يا {currentStudent.fullName} 🌟
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xl">
            أنت مسجل في <strong>{currentStudent.grade}</strong> ({currentStudent.groupName}).
            تصفح مكتبتك الذكية واختر كتابك المفضل لتبدأ رحلة جديدة من المغامرة والمعرفة.
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <Button
              variant={activeTab === 'catalog' ? 'primary' : 'secondary'}
              size="sm"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={() => setActiveTab('catalog')}
            >
              استعراض فهرس الكتب
            </Button>
            <Button
              variant={activeTab === 'my-books' ? 'primary' : 'secondary'}
              size="sm"
              icon={<BookMarked className="w-4 h-4" />}
              onClick={() => setActiveTab('my-books')}
            >
              كتبي وحجوزاتي ({activeLoans.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<QrCode className="w-4 h-4" />}
              onClick={() => setShowQRModal(true)}
            >
              بطاقتي الذكية (QR)
            </Button>
          </div>
        </div>

        {/* Book of the Week Spotlight Widget */}
        {bookOfTheWeek && (
          <div className="shrink-0 p-4 rounded-2xl bg-gradient-to-br from-gold-50 to-amber-100/70 border border-gold-200 max-w-xs shadow-xs text-right">
            <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-900 mb-2">
              <Sparkles className="w-4 h-4 text-gold-600 shrink-0" />
              <span>كتاب الأسبوع المختار</span>
            </div>
            <div className="flex gap-3 items-center">
              <div className="w-14 h-18 rounded-xl bg-gradient-to-tr from-amber-700 to-gold-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                  {bookOfTheWeek.title}
                </h4>
                <span className="font-mono text-[10px] text-amber-800 font-bold block mt-1">
                  {bookOfTheWeek.code}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Reading Challenge Card */}
      {currentChallenge && (
        <ReadingChallengeCard student={currentStudent} challenge={currentChallenge} />
      )}

      {/* 3. Main Dynamic Content: Catalog or My Books */}
      <div className="pt-2">
        {activeTab === 'catalog' ? <BookCatalog /> : <MyBooks />}
      </div>

      {/* Student QR Card Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-premium border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-slate-900">{currentStudent.fullName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentStudent.grade} • {currentStudent.groupName}
              </p>
              <div className="font-mono text-xs font-bold text-slate-700 mt-1">
                رقم الطالب: {currentStudent.internalId}
              </div>
            </div>

            <div className="flex justify-center p-2 bg-slate-50 rounded-2xl border border-slate-200">
              <QRCodeView value={currentStudent.qrToken} size={180} />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              أظهر هذا الرمز لمشرف مكتبة وثبة عند استعارة الكتب أو إعادتها
            </p>

            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowQRModal(false)}
              className="w-full"
            >
              إغلاق
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
