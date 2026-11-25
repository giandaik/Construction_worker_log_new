import React from 'react';
import { isNativeBundle } from '@/lib/native-mode';

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
  const native = isNativeBundle();
  const isLarge = size === 'lg';
  const labelClass = native
    ? 'block text-[15px] leading-[20px] text-[color:var(--ios-ink2)]'
    : isLarge
      ? 'block text-base font-semibold text-foreground'
      : 'block text-sm font-medium text-foreground';

  return (
    <div className={native ? 'px-4 py-2.5' : isLarge ? 'mb-1' : undefined}>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
        {required && <span className={native ? 'ml-0.5 text-[color:var(--ios-tint)]' : 'text-destructive ml-1'}>*</span>}
        {labelGr && (
          <span className={native ? 'mt-0.5 block text-[13px] leading-[18px] text-[color:var(--ios-ink2)]' : 'mt-0.5 block text-xs font-normal text-muted-foreground'}>
            {labelGr}
          </span>
        )}
      </label>
      {children}
      {hint && <p className={native ? 't-caption t-secondary mt-1' : 'mt-1 text-xs text-muted-foreground'}>{hint}</p>}
      {error && <p className={native ? 't-footnote mt-1 text-red-600' : 'mt-1 text-sm text-destructive'}>{error}</p>}
    </div>
  );
}
