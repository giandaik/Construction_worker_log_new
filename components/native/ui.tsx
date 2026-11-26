/**
 * Native screen vocabulary — the components every iOS screen is assembled from.
 *
 * Presentational only (no hooks), so server components can render them directly.
 * Sizes come from the design system in the `cwl-native-redesign` Open Design
 * project: 16 pt gutters, 10 pt card radius, 44 pt minimum rows, 0.5 pt hairlines,
 * and the 13 pt uppercase section header that sits *outside* the card.
 */
import Link from "next/link"
import type { ReactNode } from "react"

import { Glyph, type GlyphName } from "./icons"

export const CARD_RADIUS = 10

/** Large title block: 34 pt title, optional 15 pt subtitle, 16 pt gutter. */
export function LargeTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-4 pb-2 pt-3">
      <h1 className="t-large">{children}</h1>
      {sub ? <p className="t-subhead t-secondary mt-0.5">{sub}</p> : null}
    </div>
  )
}

/** Uppercase 13 pt header above a card, plus optional 13 pt footer below it. */
export function Section({
  title,
  footer,
  icon,
  children,
  action,
}: {
  title?: ReactNode
  footer?: ReactNode
  icon?: GlyphName
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="mt-5 first:mt-3">
      {title ? (
        <div className="mb-1.5 flex items-end justify-between px-4">
          <h2 className="t-footnote flex items-center gap-1.5 font-medium uppercase tracking-[0.04em] text-[color:var(--ios-ink2)]">
            {icon ? <Glyph name={icon} size={14} className="shrink-0" /> : null}
            <span>{title}</span>
          </h2>
          {action}
        </div>
      ) : null}
      <div className="mx-4 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)] ios-hairline">
        {children}
      </div>
      {footer ? <p className="t-footnote t-secondary mt-1.5 px-4">{footer}</p> : null}
    </section>
  )
}

/** A grouped row. 52–68 pt tall, hairline separator drawn between siblings. */
export function Row({
  title,
  subtitle,
  value,
  leading,
  trailing,
  href,
  onClick,
  chevron,
  disabled,
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  value?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  href?: string
  onClick?: () => void
  chevron?: boolean
  disabled?: boolean
  children?: ReactNode
}) {
  const body = (
    <div className="relative flex min-h-[52px] items-center gap-3 px-4 py-2">
      {leading ? <span className="shrink-0 text-[color:var(--ios-ink2)]">{leading}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? <div className="t-body leading-[22px]">{title}</div> : null}
        {subtitle ? <div className="t-footnote t-secondary mt-0.5">{subtitle}</div> : null}
        {children}
      </div>
      {value ? <div className="t-body t-secondary shrink-0">{value}</div> : null}
      {trailing}
      {chevron ? <Glyph name="chevRight" size={16} className="shrink-0 text-[#8A8A8E]" /> : null}
    </div>
  )

  const cls = `block w-full text-left [&+&]:before:absolute [&+&]:before:left-4 [&+&]:before:right-0 [&+&]:before:top-0 [&+&]:before:h-[0.5px] [&+&]:before:bg-[color:var(--ios-sep)] [&+&]:relative${
    disabled ? " pointer-events-none opacity-50" : " active:bg-black/[0.04]"
  }`

  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

const PILL_TONES: Record<string, string> = {
  ok: "bg-[#E6F4EC] text-[#146B43]",
  warn: "bg-[#FFF1D6] text-[#7A5200]",
  plan: "bg-[#EAF0FB] text-[#1F4E9C]",
  draft: "bg-[rgba(120,120,128,.14)] text-[#54545A]",
}

/** Status pill: 6 pt dot, 11 pt caption, tinted background. */
export function Pill({ tone = "draft", children }: { tone?: keyof typeof PILL_TONES; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold leading-[13px] ${PILL_TONES[tone] ?? PILL_TONES.draft}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

/** Filled accent primary, secondary fill, or plain tinted text. All 44 pt. */
export function Btn({
  variant = "primary",
  block,
  children,
  onClick,
  type = "button",
  disabled,
  href,
}: {
  variant?: "primary" | "secondary" | "plain"
  block?: boolean
  children: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
  href?: string
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[12px] px-4 text-[17px] font-semibold leading-[22px] disabled:opacity-40 active:scale-[0.985] transition-transform"
  const look =
    variant === "primary"
      ? "bg-[color:var(--ios-accent)] text-[#111] shadow-sm"
      : variant === "secondary"
        ? "bg-[rgba(118,118,128,.14)] text-[color:var(--ios-ink)]"
        : "px-2 text-[color:var(--ios-tint)]"
  const cls = `${base} ${look}${block ? " w-full" : ""}`

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  )
}

/** Two-up stat, as the Home card shows "47 work logs · 11 projects". */
export function Stat({ value, label, icon }: { value: ReactNode; label: ReactNode; icon?: GlyphName }) {
  return (
    <div className="flex-1 px-4 py-3">
      <div className="t-title2">{value}</div>
      <div className="t-footnote t-secondary mt-0.5 flex items-center gap-1.5">
        {icon ? <Glyph name={icon} size={14} className="shrink-0" /> : null}
        <span>{label}</span>
      </div>
    </div>
  )
}

/**
 * Empty state, as the design draws it (`assets/app.css` → `.empty .e-glyph`):
 * a 56 pt tinted tile holding a 26 pt glyph, a 17 pt line, one 15 pt sentence
 * and a single action. Screens were printing a bare sentence in a card.
 */
export function Empty({
  icon,
  title,
  text,
  children,
}: {
  icon: GlyphName
  title?: ReactNode
  text?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-9 text-center">
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-[16px] bg-[rgba(120,120,128,.14)] text-[color:var(--ios-ink2)]">
        <Glyph name={icon} size={26} />
      </span>
      {title ? <p className="t-headline">{title}</p> : null}
      {text ? <p className="t-subhead t-secondary max-w-[30ch]">{text}</p> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  )
}

/** Grey placeholder rows while a list is fetching. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="mx-4 mt-3 overflow-hidden rounded-[10px] bg-[color:var(--ios-card)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="h-9 w-9 shrink-0 rounded-full bg-[rgba(120,120,128,.14)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-[rgba(120,120,128,.14)]" />
            <div className="h-3 w-3/4 rounded bg-[rgba(120,120,128,.10)]" />
          </div>
        </div>
      ))}
    </div>
  )
}
