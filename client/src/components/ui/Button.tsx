/**
 * Module purpose: Defines shared button and link styling. Variants keep navigation and form actions visually consistent throughout the application.
 */
import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap';
const variants: Record<Variant, string> = {
  primary: 'bg-ledger-600 text-white hover:bg-ledger-700 active:bg-ledger-800',
  secondary: 'bg-white text-ink-900 border border-line hover:bg-paper',
  ghost: 'text-ink-700 hover:bg-ink-900/5',
  danger: 'bg-signal-600 text-white hover:bg-signal-700',
  dark: 'bg-ink-900 text-white hover:bg-ink-800',
};
const sizes: Record<Size, string> = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', extra = '') =>
  `${base} ${variants[variant]} ${sizes[size]} ${extra}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'primary', size = 'md', className = '', ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
