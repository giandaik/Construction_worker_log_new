import { normalizeTenantId } from '@/lib/tenant/normalizeTenantId';

/**
 * Explicit tenant boundary for repository construction.
 *
 * There is no third "unscoped" state. A repository is either bound to exactly
 * one tenant, or explicitly constructed in platform scope (cross-tenant,
 * SUPER_ADMIN-only). Passing `undefined`/`null` "by accident" is not possible
 * because callers must produce one of these two variants — TypeScript will
 * reject a missing argument at compile time, and `tenantContext()` throws at
 * runtime if handed an empty tenantId.
 */
export type RepositoryContext =
  | { readonly scope: 'tenant'; readonly tenantId: string }
  | { readonly scope: 'platform' };

/**
 * Builds a tenant-scoped context. Throws rather than silently degrading to
 * "no filter" if `tenantId` is missing/empty — a tenant-scoped repository
 * must never be constructed without a real tenant to bind to.
 */
export function tenantContext(tenantId: string | null | undefined): RepositoryContext {
  if (!tenantId) {
    throw new Error(
      'tenantContext() requires a non-empty tenantId — refusing to construct an unscoped (cross-tenant) repository'
    );
  }
  // Fail closed on malformed tenant IDs before any repository can query MongoDB.
  normalizeTenantId(tenantId);
  return { scope: 'tenant', tenantId };
}

/**
 * Explicit opt-in to cross-tenant (platform) access. Only SUPER_ADMIN-gated
 * code paths should ever construct this.
 */
export const PLATFORM_CONTEXT: RepositoryContext = { scope: 'platform' };
