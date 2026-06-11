interface FormSectionProps {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ step, title, description, children }: FormSectionProps) {
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
  );
}
