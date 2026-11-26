"use client"

import * as Dialog from "@radix-ui/react-dialog"
import type { ReactNode } from "react"

import { Glyph } from "./icons"

/** Search field — 44 pt tall, as the design's `.search` is (not 36). */
export function SearchField({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}) {
  return (
    <div className="mx-4 mb-2 flex min-h-[44px] items-center gap-2 rounded-[10px] bg-[rgba(118,118,128,.12)] px-3">
      <Glyph name="search" size={16} className="shrink-0 text-[color:var(--ios-ink2)]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        className="t-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-[color:var(--ios-ink2)]"
        style={{ fontSize: 17 }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(120,120,128,.28)]"
        >
          <Glyph name="x" size={12} />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Segmented control — the design's `.seg--filled`: 2 pt inset, 13 pt outer radius,
 * 11 pt thumb radius, and 44 pt buttons (`min-width: 44px` too, so a two-option
 * control still clears the target size). The 32/28 pt version measured 28 pt taps.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div
      role="tablist"
      className="mx-4 mb-2 flex gap-[2px] rounded-[13px] bg-[rgba(118,118,128,.12)] p-[2px]"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-[44px] min-w-[44px] flex-1 rounded-[11px] text-[15px] font-semibold leading-5 ${
              active
                ? "bg-[color:var(--ios-card)] text-[color:var(--ios-ink)] shadow-sm"
                : "text-[color:var(--ios-ink2)]"
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** Bottom sheet used for filters, the account block and secondary pickers. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-label={title}
          className="safe-b fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[14px] bg-[color:var(--ios-card)] px-4 pb-4 pt-2"
        >
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-[color:var(--ios-sep)]" />
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="t-headline">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="ios-tap px-2 text-[17px] font-semibold text-[color:var(--ios-tint)]"
              >
                Done
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
