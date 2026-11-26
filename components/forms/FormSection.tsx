import { isNativeBundle } from "@/lib/native-mode"

interface FormSectionProps {
  step: number
  title: string
  description?: string
  children: React.ReactNode
}

/**
 * Web: numbered card section.
 * Native: the 13 pt uppercase header sits *above* a grouped inset card, which is
 * the iOS form grammar — no step numbers, no box inside a box.
 */
export function FormSection({ step, title, description, children }: FormSectionProps) {
  if (isNativeBundle()) {
    return (
      <section className="mt-5 first:mt-2">
        <div className="mb-1.5 px-4">
          <h3 className="t-footnote font-medium uppercase tracking-[0.04em] text-[color:var(--ios-ink2)]">
            {title}
          </h3>
          {description ? <p className="t-footnote t-secondary mt-1">{description}</p> : null}
        </div>
        <div className="ios-stack mx-4 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)] ios-hairline">
          {children}
        </div>
      </section>
    )
  }


  return (
    <section
      className="animate-fade-up rounded-md border bg-card p-4 sm:p-6"
      style={{ animationDelay: `${step * 60}ms` }}
    >
      <div className="mb-4 flex items-center gap-3 border-b pb-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary font-display text-lg font-bold text-primary-foreground">
          {step}
        </span>
        <div>
          <h3 className="text-lg font-semibold uppercase tracking-wide">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
