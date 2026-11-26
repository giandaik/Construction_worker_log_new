"use client"

import Link from "next/link"
import Image from "next/image"
import * as Dialog from "@radix-ui/react-dialog"
import { useState } from "react"

import { useCurrentUser } from "@/hooks/useCurrentUser"
import { LogoutButton } from "@/components/LogoutButton"
import { Glyph } from "./icons"

/**
 * Account presented as a native sheet (slides from the bottom, grabber, grouped
 * rows), not a fifth page. Radix Dialog gives the focus trap and Escape for free.
 */
export function AccountSheet({
  trigger,
  admin,
}: {
  trigger: React.ReactNode
  admin: boolean
}) {
  const { user } = useCurrentUser()
  const [open, setOpen] = useState(false)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className="safe-b fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-[14px] bg-[color:var(--ios-card)] px-4 pb-4 pt-2 shadow-2xl"
          aria-label="Account"
        >
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[color:var(--ios-sep)]" />

          <div className="mb-4 flex items-center gap-3">
            <Image
              src="/sitely-logo.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg"
            />
            <div className="min-w-0">
              <div className="t-headline truncate">{user?.name || "Signed in"}</div>
              <div className="t-footnote t-secondary truncate">{user?.email}</div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--ios-surface)]"
              >
                <Glyph name="x" size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="ios-card overflow-hidden border" style={{ borderColor: "var(--ios-sep)" }}>
            <div className="flex min-h-[44px] items-center justify-between px-4">
              <span className="t-subhead t-secondary">Role</span>
              <span className="t-subhead">{user?.role || "—"}</span>
            </div>

            {admin && (
              <>
                <div className="ml-4 h-[0.5px]" style={{ backgroundColor: "var(--ios-sep)" }} />
                <Link
                  href="/admin/users"
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center justify-between px-4"
                >
                  <span className="t-body flex items-center gap-2">
                    <Glyph name="users" size={19} /> Users
                  </span>
                  <Glyph name="chevRight" size={16} className="text-[#8A8A8E]" />
                </Link>
              </>
            )}
          </div>

          <div className="mt-4">
            <LogoutButton row />
          </div>

          <p className="t-caption t-secondary mt-3 text-center">Construction Worker Log · iOS</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
