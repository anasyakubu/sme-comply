/**
 * Module purpose: Defines accessible reusable inputs, selects, checkboxes, and textareas. Form components share labeling, help text, and validation errors.
 */
import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';

interface WrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
}

function FieldWrapper({ label, hint, error, required, children, className = '' }: WrapperProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && <span className="text-signal-600"> *</span>}
        </label>
      )}
      {children(id, describedBy)}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-signal-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label?: string; hint?: string; error?: string; wrapperClassName?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common>(function Input(
  { label, hint, error, wrapperClassName, className = '', required, ...rest },
  ref,
) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {(id, describedBy) => (
        <input
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`input ${error ? 'input-error' : ''} ${className}`}
          {...rest}
        />
      )}
    </FieldWrapper>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & Common & { options: Array<string | { value: string; label: string }>; placeholder?: string }
>(function Select({ label, hint, error, wrapperClassName, className = '', options, placeholder, required, ...rest }, ref) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {(id, describedBy) => (
        <select
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`input pr-8 ${error ? 'input-error' : ''} ${className}`}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            );
          })}
        </select>
      )}
    </FieldWrapper>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Common>(function Textarea(
  { label, hint, error, wrapperClassName, className = '', required, ...rest },
  ref,
) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {(id, describedBy) => (
        <textarea
          ref={ref}
          id={id}
          rows={3}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`input ${error ? 'input-error' : ''} ${className}`}
          {...rest}
        />
      )}
    </FieldWrapper>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }>(
  function Checkbox({ label, description, className = '', ...rest }, ref) {
    const id = useId();
    return (
      <div className={`flex items-start gap-3 ${className}`}>
        <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line text-ledger-600 focus:ring-ledger-500" {...rest} />
        <label htmlFor={id} className="text-sm">
          <span className="font-medium text-ink-900">{label}</span>
          {description && <span className="block text-ink-500">{description}</span>}
        </label>
      </div>
    );
  },
);
