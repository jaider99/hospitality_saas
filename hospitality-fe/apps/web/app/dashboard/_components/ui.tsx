import React from 'react';

export function Badge({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral' }) {
  const s = {
    success: 'bg-[#e6f4ec] text-[#1f8f5c]',
    warning: 'bg-[#fbf1dd] text-[#b07a1a]',
    error: 'bg-[#fceaea] text-[#b23a3a]',
    info: 'bg-[#e6eef8] text-[#2f6bb0]',
    neutral: 'bg-muted text-muted-foreground',
  };
  return <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${s[variant]}`}>{children}</span>;
}

export function Btn({ children, variant = 'primary', size = 'md', className, onClick, disabled }: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base = 'inline-flex items-center justify-center font-medium transition-colors rounded-lg gap-1.5 leading-none disabled:opacity-60 cursor-pointer';
  const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2' };
  const variants = {
    primary: 'bg-[#151515] text-white hover:opacity-90 dark:bg-[#efede7] dark:text-[#14130f]',
    secondary: 'bg-card text-foreground border border-border hover:bg-muted',
    ghost: 'text-muted-foreground hover:text-foreground hover:bg-muted',
    danger: 'text-[#b23a3a] hover:bg-[#fceaea] dark:text-[#ff6b6b] dark:hover:bg-[#ff6b6b]/10',
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>{children}</button>;
}

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${on ? 'bg-[#1f8f5c]' : 'bg-muted'}`}>
      <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}
