import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'outline';
type Size = 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white active:bg-blue-950',
  success: 'bg-ok text-white active:bg-green-900',
  danger: 'bg-bad text-white active:bg-red-900',
  warning: 'bg-warn-bar text-warn-ink active:bg-yellow-600',
  neutral: 'bg-slate-200 text-slate-900 active:bg-slate-300',
  outline: 'bg-white text-brand border-4 border-brand active:bg-brand-soft',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-touch px-5 text-lg',
  lg: 'min-h-[80px] px-6 text-xl',
  xl: 'min-h-huge px-6 text-2xl',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Optional icon shown beside the text label — never instead of it. */
  icon?: ReactNode;
  block?: boolean;
}

export function BigButton({ variant = 'primary', size = 'md', icon, block = true, className = '', children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-3 rounded-2xl font-bold shadow-sm',
        'transition-transform active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100',
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-amber-400',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {icon && <span aria-hidden="true" className="text-[1.2em] leading-none">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
