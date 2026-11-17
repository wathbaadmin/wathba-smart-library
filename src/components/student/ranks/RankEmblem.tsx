import React from 'react';
import { ReadingRankThemeKey } from '../../../types';
import {
  ScrollText,
  GraduationCap,
  Award,
  Gem,
  Crown,
  Sparkles,
  Lock,
} from 'lucide-react';

interface RankEmblemProps {
  themeKey: ReadingRankThemeKey;
  primaryColor?: string;
  accentColor?: string;
  status?: 'earned' | 'in_progress' | 'locked';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isHighest?: boolean;
  className?: string;
}

export const RankEmblem: React.FC<RankEmblemProps> = ({
  themeKey,
  primaryColor = '#3b707d',
  accentColor = '#d4af37',
  status = 'earned',
  size = 'md',
  isHighest = false,
  className = '',
}) => {
  const isLocked = status === 'locked';
  const isWathab = themeKey === 'wathab' || isHighest;

  const dimensions =
    size === 'xs'
      ? 'w-7 h-7 rounded-lg'
      : size === 'sm'
      ? 'w-11 h-11 rounded-2xl'
      : size === 'lg'
      ? 'w-20 h-20 rounded-3xl'
      : 'w-14 h-14 rounded-2xl';

  const iconSize =
    size === 'xs' ? 'w-3.5 h-3.5' : size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';

  const renderIcon = () => {
    switch (themeKey) {
      case 'diploma':
        return <ScrollText className={iconSize} />;
      case 'bachelor':
        return <GraduationCap className={iconSize} />;
      case 'master':
        return <Award className={iconSize} />;
      case 'doctorate':
        return <Gem className={iconSize} />;
      case 'wathab':
        return <Crown className={iconSize} />;
      default:
        return <Sparkles className={iconSize} />;
    }
  };

  if (isLocked) {
    return (
      <div
        className={`${dimensions} ${className} bg-slate-100 border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center relative shrink-0`}
      >
        {renderIcon()}
        <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-slate-500">
          <Lock className="w-2.5 h-2.5" />
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} ${className} flex items-center justify-center relative shrink-0 shadow-soft ${
        isWathab
          ? 'ring-2 ring-gold-400 shadow-premium'
          : status === 'in_progress'
          ? 'ring-2 ring-amber-300'
          : ''
      }`}
      style={{
        background: isWathab
          ? 'linear-gradient(135deg, #162b31 0%, #27434b 55%, #b45309 100%)'
          : `linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%)`,
        color: isWathab ? '#fef08a' : '#ffffff',
      }}
    >
      {renderIcon()}
      {isWathab && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gold-400 text-slate-950 flex items-center justify-center border-2 border-white shadow-xs">
          <Sparkles className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
};
