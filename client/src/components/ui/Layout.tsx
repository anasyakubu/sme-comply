/**
 * Module purpose: Provides common page headers, searching, pagination, tabs, and responsive table pieces to avoid repeating page layout logic.
 */
import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { PageMeta } from '../../types';

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6">
      {back && <div className="mb-2 text-sm">{back}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <div className="mt-1 max-w-2xl text-sm text-ink-500">{description}</div>}
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/**
 * Provides a reusable controlled search field.
 */
export function SearchInput({ value, onChange, placeholder = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-9"
      />
    </div>
  );
}

/**
 * Uses API page metadata to navigate a paginated list.
 */
export function Pagination({ meta, onPage }: { meta?: PageMeta; onPage: (p: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <nav className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-500" aria-label="Pagination">
      <span className="tabular">
        {from}–{to} of {meta.total}
      </span>
      <div className="flex gap-1">
        <button
          className="rounded border border-line p-1.5 hover:bg-paper disabled:opacity-40"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          className="rounded border border-line p-1.5 hover:bg-paper disabled:opacity-40"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
            value === t.value ? 'border-ledger-600 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900'
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular ml-1.5 text-xs text-ink-400">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A table that becomes stacked rows on small screens. */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="hidden border-b border-line text-xs text-ink-500 md:table-header-group">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, label, className = '' }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <td className={`block px-4 py-1 md:table-cell md:py-3 ${className}`}>
      {label && <span className="mr-2 text-xs text-ink-400 md:hidden">{label}</span>}
      {children}
    </td>
  );
}
