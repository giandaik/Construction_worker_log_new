import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

export interface NavLink {
  href: string
  label: string
  icon: LucideIcon
  /** Restrict to admin/manager roles. */
  adminOnly?: boolean
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/worklogs", label: "Work Logs", icon: FileText },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/admin/users", label: "Admin", icon: ShieldCheck, adminOnly: true },
]

/**
 * Mirrors utils/auth.isAdmin without dragging server-only helpers
 * (getAuthUser, cookie handling) into the client bundle.
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "manager"
}

export function isNavLinkVisible(
  link: NavLink,
  role: string | undefined | null,
): boolean {
  return !link.adminOnly || isAdminRole(role)
}
