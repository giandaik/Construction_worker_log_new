import { describe, it, expect } from "vitest"

import { buildBreadcrumbTrail } from "@/components/layout/Breadcrumbs"
import { isPathActive } from "@/components/layout/Navbar"
import {
  NAV_LINKS,
  isAdminRole,
  isNavLinkVisible,
} from "@/components/layout/navConfig"
import { isPublicPath } from "@/components/layout/AppShell"

describe("buildBreadcrumbTrail", () => {
  it("returns a single Home crumb for the root route", () => {
    expect(buildBreadcrumbTrail("/")).toEqual([{ href: "/", label: "Home" }])
  })

  it("maps static sections to labelled crumbs", () => {
    expect(buildBreadcrumbTrail("/projects")).toEqual([
      { href: "/", label: "Home" },
      { href: "/projects", label: "Projects" },
    ])
  })

  it("marks an id under /projects as a dynamic project crumb", () => {
    expect(buildBreadcrumbTrail("/projects/abc123")).toEqual([
      { href: "/", label: "Home" },
      { href: "/projects", label: "Projects" },
      { href: "/projects/abc123", dynamic: { kind: "project", id: "abc123" } },
    ])
  })

  it("appends static sub-routes under a dynamic project crumb", () => {
    expect(buildBreadcrumbTrail("/projects/abc123/calendar")).toEqual([
      { href: "/", label: "Home" },
      { href: "/projects", label: "Projects" },
      { href: "/projects/abc123", dynamic: { kind: "project", id: "abc123" } },
      { href: "/projects/abc123/calendar", label: "Calendar" },
    ])
  })

  it("marks an id under /worklogs as a dynamic worklog crumb", () => {
    expect(buildBreadcrumbTrail("/worklogs/xyz/edit")).toEqual([
      { href: "/", label: "Home" },
      { href: "/worklogs", label: "Work Logs" },
      { href: "/worklogs/xyz", dynamic: { kind: "worklog", id: "xyz" } },
      { href: "/worklogs/xyz/edit", label: "Edit" },
    ])
  })

  it("resolves nested admin and forms routes", () => {
    expect(buildBreadcrumbTrail("/admin/users")).toEqual([
      { href: "/", label: "Home" },
      { href: "/admin", label: "Admin" },
      { href: "/admin/users", label: "Users" },
    ])
    expect(buildBreadcrumbTrail("/admin/projects/new")).toEqual([
      { href: "/", label: "Home" },
      { href: "/admin", label: "Admin" },
      { href: "/admin/projects", label: "Projects" },
      { href: "/admin/projects/new", label: "New" },
    ])
    expect(buildBreadcrumbTrail("/forms/new")).toEqual([
      { href: "/", label: "Home" },
      { href: "/forms", label: "Forms" },
      { href: "/forms/new", label: "New" },
    ])
  })

  it("uses the raw segment as the label when it is not a known static or dynamic route", () => {
    expect(buildBreadcrumbTrail("/admin/unknown-id")).toEqual([
      { href: "/", label: "Home" },
      { href: "/admin", label: "Admin" },
      { href: "/admin/unknown-id", label: "unknown-id" },
    ])
  })
})

describe("navConfig role gating", () => {
  const adminLink = NAV_LINKS.find((l) => l.adminOnly)!
  const publicLink = NAV_LINKS.find((l) => !l.adminOnly)!

  it("treats admin and manager as admin-capable", () => {
    expect(isAdminRole("admin")).toBe(true)
    expect(isAdminRole("manager")).toBe(true)
    expect(isAdminRole("user")).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
  })

  it("shows the admin link only to admin/manager", () => {
    expect(isNavLinkVisible(adminLink, "admin")).toBe(true)
    expect(isNavLinkVisible(adminLink, "manager")).toBe(true)
    expect(isNavLinkVisible(adminLink, "user")).toBe(false)
    expect(isNavLinkVisible(adminLink, undefined)).toBe(false)
  })

  it("shows non-admin links to everyone", () => {
    expect(isNavLinkVisible(publicLink, "user")).toBe(true)
    expect(isNavLinkVisible(publicLink, undefined)).toBe(true)
  })
})

describe("isPublicPath", () => {
  it("is true for login and signup (and their sub-paths)", () => {
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/signup")).toBe(true)
    expect(isPublicPath("/login/forgot")).toBe(true)
    expect(isPublicPath("/signup/foo")).toBe(true)
  })

  it("is false for authenticated routes", () => {
    expect(isPublicPath("/")).toBe(false)
    expect(isPublicPath("/dashboard")).toBe(false)
    expect(isPublicPath("/projects")).toBe(false)
    expect(isPublicPath("/admin/users")).toBe(false)
  })

  it("does not match routes that merely start with the public names", () => {
    expect(isPublicPath("/loginside")).toBe(false)
  })
})

describe("isPathActive", () => {
  it("is active for Home only on the exact root", () => {
    expect(isPathActive("/", "/")).toBe(true)
    expect(isPathActive("/projects", "/")).toBe(false)
  })

  it("is prefix-active for section links with a trailing slash boundary", () => {
    expect(isPathActive("/projects", "/projects")).toBe(true)
    expect(isPathActive("/projects/abc", "/projects")).toBe(true)
    expect(isPathActive("/projectsabc", "/projects")).toBe(false)
  })
})
