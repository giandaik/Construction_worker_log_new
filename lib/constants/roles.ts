export const PLATFORM_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES];

// Lowercase is accepted only when reading legacy records created before the canonical value.
export function isSuperAdminRole(value: unknown): boolean {
  return typeof value === 'string' && value.toUpperCase() === PLATFORM_ROLES.SUPER_ADMIN;
}