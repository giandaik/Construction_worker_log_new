import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArrayFieldProps<T> {
  title: string;
  /** Optional Greek subtitle shown under the (English) title. */
  titleGr?: string;
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderFields: (item: T, index: number) => React.ReactNode;
  addButtonText: string;
  className?: string;
  addDisabled?: boolean;
  disabledMessage?: string;
}

/**
 * Generic component for managing array fields in forms
 * Provides consistent UI for adding, removing, and editing array items
 */
export function ArrayField<T>({
  title,
  titleGr,
  items,
  onAdd,
  onRemove,
  renderFields,
  addButtonText,
  className,
  addDisabled,
  disabledMessage,
}: ArrayFieldProps<T>) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {titleGr && <p className="text-xs text-muted-foreground">{titleGr}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={addDisabled}
        >
          {addButtonText}
        </Button>
      </div>

      {addDisabled && disabledMessage && (
        <p className="text-sm text-muted-foreground italic">{disabledMessage}</p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No {title.toLowerCase()} added yet. Click the button above to add one.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="relative p-4 border rounded-lg bg-card space-y-3"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                className="absolute top-2 right-2 h-8 w-8"
                aria-label={`Remove ${title.toLowerCase()} ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </Button>
              {renderFields(item, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
