import React from 'react';

export interface ChartDatum {
  label: string;
  value: number;
  subLabel?: string;
  color?: string;
}

interface HorizontalBarChartProps {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  unit?: string;
  accentColor?: string;
  emptyText?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  title,
  subtitle,
  data,
  unit = '',
  accentColor = '#3b707d',
  emptyText = 'لا توجد بيانات كافية للرسم البياني خلال هذه الفترة',
}) => {
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-4">
      <div>
        <h4 className="font-black text-sm text-slate-900">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {data.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item, idx) => {
            const pct = Math.max(3, Math.round((item.value / maxVal) * 100));
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-slate-800 truncate">{item.label}</span>
                  <span className="font-black text-slate-900 shrink-0 font-mono">
                    {item.value.toLocaleString('ar-SA')} {unit}
                    {item.subLabel && (
                      <span className="text-[10px] text-slate-400 font-arabic mr-1">
                        ({item.subLabel})
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.value === 0 ? 0 : pct}%`,
                      backgroundColor: item.color || accentColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface VerticalColumnChartProps {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  unit?: string;
  color?: string;
  emptyText?: string;
}

export const VerticalColumnChart: React.FC<VerticalColumnChartProps> = ({
  title,
  subtitle,
  data,
  unit = '',
  color = '#3b707d',
  emptyText = 'لا توجد بيانات زمنية مسجلة',
}) => {
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft space-y-4">
      <div>
        <h4 className="font-black text-sm text-slate-900">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {data.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          {emptyText}
        </div>
      ) : (
        <div className="pt-2">
          <div className="flex items-end justify-around gap-2 h-44 border-b border-slate-200 pb-2 px-2">
            {data.map((item, idx) => {
              const barH = item.value === 0 ? 4 : Math.max(10, Math.round((item.value / maxVal) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-[36px]">
                  <span className="text-[10px] font-black text-slate-800 font-mono">
                    {item.value}
                    {unit ? ` ${unit}` : ''}
                  </span>
                  <div className="w-full max-w-[38px] bg-slate-100 rounded-t-xl flex items-end h-full overflow-hidden">
                    <div
                      className="w-full rounded-t-xl transition-all duration-500"
                      style={{
                        height: `${barH}%`,
                        backgroundColor: item.color || color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-start justify-around gap-2 pt-2 px-2">
            {data.map((item, idx) => (
              <div key={idx} className="flex-1 text-center text-[10px] font-bold text-slate-600 truncate">
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface DonutMetricCardProps {
  title: string;
  percent: number;
  centerLabel: string;
  subLabel: string;
  color?: string;
}

export const DonutMetricCard: React.FC<DonutMetricCardProps> = ({
  title,
  percent,
  centerLabel,
  subLabel,
  color = '#3b707d',
}) => {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (safePercent / 100) * c;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-soft flex items-center gap-4">
      <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="#e3ecf3"
            strokeWidth="9"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-900">
          {safePercent}%
        </div>
      </div>

      <div className="space-y-1 text-right">
        <div className="text-xs font-bold text-slate-500">{title}</div>
        <div className="text-base font-black text-slate-900">{centerLabel}</div>
        <div className="text-[11px] text-slate-500 leading-relaxed">{subLabel}</div>
      </div>
    </div>
  );
};
