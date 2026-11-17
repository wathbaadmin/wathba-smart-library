import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  color?: 'brand' | 'secondary' | 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';
  actionLabel?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendType = 'neutral',
  color = 'brand',
  actionLabel,
  onClick,
}) => {
  const colorSchemes = {
    brand: {
      iconBg: 'bg-[#3b707d] text-white',
      border: 'border-slate-200 hover:border-[#3b707d]/50',
      action: 'text-[#3b707d]',
    },
    secondary: {
      iconBg: 'bg-[#e3ecf3] text-[#27434b]',
      border: 'border-slate-200 hover:border-[#3b707d]/50',
      action: 'text-[#3b707d]',
    },
    emerald: {
      iconBg: 'bg-[#3b707d] text-white',
      border: 'border-slate-200 hover:border-[#3b707d]/50',
      action: 'text-[#3b707d]',
    },
    blue: {
      iconBg: 'bg-[#e3ecf3] text-[#27434b]',
      border: 'border-slate-200 hover:border-[#3b707d]/50',
      action: 'text-[#3b707d]',
    },
    amber: {
      iconBg: 'bg-amber-100 text-amber-800',
      border: 'border-slate-200 hover:border-amber-300',
      action: 'text-amber-800',
    },
    rose: {
      iconBg: 'bg-rose-100 text-rose-700',
      border: 'border-slate-200 hover:border-rose-300',
      action: 'text-rose-700',
    },
    purple: {
      iconBg: 'bg-[#2b4e57] text-white',
      border: 'border-slate-200 hover:border-[#3b707d]/50',
      action: 'text-[#2b4e57]',
    },
  };

  const scheme = colorSchemes[color] || colorSchemes.brand;

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-right relative p-4 sm:p-5 rounded-2xl bg-white border ${scheme.border} shadow-soft hover:shadow-card transition-all duration-150 flex flex-col justify-between gap-3 ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[#3b707d]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="min-w-0">
          <span className="text-xs font-bold text-slate-500 block">{title}</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tracking-tight leading-none">
            {value}
          </div>
          {subtitle && (
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1.5 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-2xl shadow-sm shrink-0 flex items-center justify-center ${scheme.iconBg}`}>
          {icon}
        </div>
      </div>

      {(trend || (onClick && actionLabel)) && (
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 w-full">
          {trend ? (
            <span
              className={`text-[11px] font-bold ${
                trendType === 'positive'
                  ? 'text-emerald-700'
                  : trendType === 'negative'
                  ? 'text-rose-700'
                  : 'text-slate-500'
              }`}
            >
              {trend}
            </span>
          ) : (
            <span />
          )}

          {onClick && (
            <span className={`inline-flex items-center gap-1 text-xs font-black ${scheme.action}`}>
              <span>{actionLabel || 'عرض التفاصيل'}</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      )}
    </Wrapper>
  );
};
