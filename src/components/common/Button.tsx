import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'royal' | 'outline' | 'danger' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b707d] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] select-none';

  const variants = {
    primary:
      'bg-[#3b707d] text-white hover:bg-[#315d68] shadow-soft hover:shadow-card',
    secondary:
      'bg-[#e3ecf3] text-[#27434b] hover:bg-[#d3e2ee] border border-[#c5d8df]',
    royal:
      'bg-[#2b4e57] text-white hover:bg-[#1f3b42] shadow-soft hover:shadow-card',
    outline:
      'border border-[#3b707d] text-[#3b707d] bg-white hover:bg-[#e3ecf3]/50',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 shadow-soft',
    ghost:
      'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    gold:
      'bg-amber-400 text-slate-900 font-black hover:bg-amber-300 shadow-soft',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-2 gap-1.5 min-h-[40px]',
    md: 'text-sm px-4 py-2.5 gap-2 min-h-[44px]',
    lg: 'text-base px-6 py-3 gap-2.5 min-h-[48px] font-black',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
