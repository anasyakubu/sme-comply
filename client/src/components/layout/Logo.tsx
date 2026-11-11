/**
 * Module purpose: Renders a consistent brand mark and destination across the public and authenticated layouts.
 */
import { Link } from 'react-router-dom';

export function Logo({ to = '/', inverse = false }: { to?: string; inverse?: boolean }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2" aria-label="SME Comply home">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="6" fill={inverse ? '#fff' : '#14233B'} />
        <path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#2F8A61" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-lg font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-ink-900'}`}>SME Comply</span>
    </Link>
  );
}
