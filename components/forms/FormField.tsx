import React from 'react';

interface FormFieldProps {
  label: string;
  /** Optional Greek subtitle shown under the (English) label for bilingual workers. */
  labelGr?: string;
  htmlFor: string;
  required?: boolean;
  /** `lg` promotes a load-bearing field: larger, bolder label + more room. */
  size?: 'default' | 'lg';
  hint?: string;
  children: React.ReactNode;
  error?: string;
}

/**
 * Reusable form field wrapper with label and error display.
 * Use `size="lg"` for the few decisions that carry the most weight so the
 * form has real visual hierarchy instead of reading flat top to bottom.
 * Pass `labelGr` for a smaller Greek translation under the English label.
 */
export function FormField({ label, labelGr, htmlFor, required, size = 'default', hint, children, error }: FormFieldProps) {
  const isLarge = size === 'lg';
  const labelClass = isLarge
    ? 'block text-base font-semibold text-foreground'
    : 'block text-sm font-medium text-foreground';

  return (
    <div className={isLarge ? 'mb-1' : undefined}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
        {labelGr && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{labelGr}</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}
