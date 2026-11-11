/**
 * Module purpose: Provides loading, skeleton, empty, and error states so pages handle unavailable or delayed data consistently.
 */
import { ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner label="Loading SME Comply" />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ink-900/[0.06] ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-300">{icon}</div>}
      <h3 className="font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" role="alert">
      <AlertTriangle className="mb-2 h-6 w-6 text-signal-600" aria-hidden />
      <p className="text-sm text-ink-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
