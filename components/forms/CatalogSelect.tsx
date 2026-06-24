'use client';

import { useMemo } from 'react';

interface CatalogSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Strict select bound to a project-managed catalog. If the current value is not
 * in the catalog (e.g. a legacy worklog edited after the catalog was tightened),
 * it is appended as an "(εκτός καταλόγου)" option so the value is not silently
 * lost on save.
 */
export function CatalogSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Επιλέξτε…',
  disabled,
}: CatalogSelectProps) {
  const orphanValue = value && !options.includes(value) ? value : null;

  const selectClass =
    'mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-ring focus:ring-ring sm:text-sm';

  const renderedOptions = useMemo(() => {
    return options.map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ));
  }, [options]);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {renderedOptions}
      {orphanValue && (
        <option value={orphanValue}>{orphanValue} (εκτός καταλόγου)</option>
      )}
    </select>
  );
}
