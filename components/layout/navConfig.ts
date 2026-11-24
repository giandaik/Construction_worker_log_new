import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  ShieldCheck,
  Building2,
  type LucideIcon,
} from "lucide-react";

import { PLATFORM_ROLES } from "@/lib/constants/roles";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;

  /**
   * Visible only to tenant ADMIN/MANAGER users.
   * SuperAdmin uses the platform navigation instead.
   */
  adminOnly?: boolean;

  /**
   * Visible only to platform SuperAdmin users.
   */
  superAdminOnly?: boolean;
}

/**
 * Navigation available to authenticated users.
 *
 * "/" is intentionally NOT included here.
 * The public landing page lives at "/".
 * Authenticated application home is "/app".
 */
export const NAV_LINKS: NavLink[] = [
  {
    href: "/app",
    label: "Home",
    icon: LayoutDashboard,
  },
  {
    href: "/worklogs",
    label: "Work Logs",
    icon: FileText,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderOpen,
  },
  {
    href: "/admin/users",
    label: "Admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
  {
    href: "/platform",
    label: "Platform",
    icon: Building2,
    superAdminOnly: true,
  },
];

/**
 * Client-safe tenant role check.
 *
 * Tenant roles:
 *   ADMIN
 *   MANAGER
 *   WORKER
 *
 * SUPER_ADMIN is NOT a tenant role.
 */
export function isAdminRole(
  role: string | undefined | null,
): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "admin" || role === "manager" ;
}

/**
 * Determines whether the authenticated user is a platform SuperAdmin.
 *
 * SuperAdmin is intentionally separate from tenant roles.
 */
export function isPlatformUser(
  platformRole: string | undefined | null,
): boolean {
  return platformRole === PLATFORM_ROLES.SUPER_ADMIN;
}

/**
 * Determines whether a navigation item should be visible.
 *
 * This controls UI visibility only.
 * It is NOT an authorization mechanism.
 *
 * Every protected API/page must independently enforce authorization
 * on the server.
 */
export function isNavLinkVisible(
  link: NavLink,
  role: string | undefined | null,
  platformRole: string | undefined | null,
): boolean {
  const isSuperAdmin =
    platformRole === PLATFORM_ROLES.SUPER_ADMIN;

  // Platform navigation is exclusively for SuperAdmin.
  if (link.superAdminOnly) {
    return isSuperAdmin;
  }

  // Tenant administration is exclusively for tenant ADMIN/MANAGER.
  // SuperAdmin has separate platform administration.
  if (link.adminOnly) {
    return !isSuperAdmin && isAdminRole(role);
  }

  // Normal tenant navigation is not shown to platform-only users.
  return !isSuperAdmin;
}

