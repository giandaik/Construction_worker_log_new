import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isNativeBundle } from '@/lib/native-mode';
import { Btn } from '@/components/native/ui';

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
 *
 * Native: the title row *is* the card row — 16 pt inset, 52 pt minimum, the
 * add action is a tinted trailing label (never a bordered button inside a
 * card), and the empty hint sits under the title at the same inset instead of
 * spanning the card edge to edge.
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
  if (isNativeBundle()) {
    return (
      <div>
        <div className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="t-body">{title}</div>
            {titleGr ? <div className="t-footnote t-secondary mt-0.5">{titleGr}</div> : null}
            {items.length === 0 ? (
              <p className="t-footnote t-secondary mt-1">
                {addDisabled && disabledMessage
                  ? disabledMessage
                  : `No ${title.toLowerCase()} added yet.`}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {items.length > 0 ? (
              <span className="t-footnote t-secondary">{items.length}</span>
            ) : null}
            <Btn variant="plain" onClick={onAdd} disabled={addDisabled}>
              {addButtonText}
            </Btn>
          </div>
        </div>

        {items.map((item, index) => (
          <div key={index} className="relative px-4 py-2.5">
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${title.toLowerCase()} ${index + 1}`}
              className="ios-tap absolute right-0 top-0 z-10 flex w-11 items-center justify-center text-[color:var(--ios-ink2)]"
            >
              <X className="h-4 w-4" />
            </button>
            {renderFields(item, index)}
          </div>
        ))}
      </div>
    );
  }

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
