/**
 * Module purpose: Provides modal dialogs and confirmation prompts, including keyboard dismissal and controlled open/close behavior.
 */
import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

/**
 * Displays accessible overlay content and handles closing and keyboard interaction.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the focus effect on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const first = dialogRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  const width = size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink-900/40" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex max-h-[92vh] w-full ${width} flex-col rounded-t-lg bg-white shadow-raise sm:rounded-lg`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id="modal-title" className="text-lg font-bold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          <button data-close onClick={onClose} className="rounded p-1 text-ink-500 hover:bg-paper" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Requires explicit confirmation before carrying out destructive actions.
 */
export function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">{message}</p>
    </Modal>
  );
}
