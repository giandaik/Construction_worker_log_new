import { RepositoryFactory } from '@/lib/repositories';
import type { AuthUser } from '@/utils/auth';

/**
 * How much authority a role carries inside a tenant.
 *
 * The two vocabularies meet here: a `User.role` is `admin | manager | user`,
 * a membership's `tenantRole` is `ADMIN | MANAGER | WORKER`, and `user` and
 * `WORKER` are the same rung. Anything unrecognised ranks below everything,
 * so an unknown role can neither be granted nor grant.
 */
const ROLE_RANK: Record<string, number> = {
  ADMIN: 3,
  MANAGER: 2,
  WORKER: 1,
  USER: 1,
};

export function roleRank(role: string | undefined | null): number {
  if (typeof role !== 'string') {
    return 0;
  }

  return ROLE_RANK[role.toUpperCase()] ?? 0;
}

/**
 * Whether a creator holding `creatorRole` may hand out `targetRole`.
 *
 * `isAdmin` admits managers as well as admins, so without this a manager could
 * POST /api/users with `role: 'admin'` and mint an account outranking their
 * own — a one-request privilege escalation inside their own tenant.
 */
export function canAssignRole(
  creatorRole: string | undefined | null,
  targetRole: string | undefined | null,
): boolean {
  const creator = roleRank(creatorRole);

  return creator > 0 && roleRank(targetRole) <= creator;
}

/**
 * The creator's role as the database records it.
 *
 * The membership is the authority, not the token: a JWT minted before a
 * demotion still claims the old role. Tokens with no tenant (the platform
 * super-admin) fall back to the token's own role.
 */
export async function resolveTenantRole(user: AuthUser): Promise<string | undefined> {
  if (!user.tenantId) {
    return user.role;
  }

  const membership = await RepositoryFactory.getMembershipRepository().findMembership(
    user.userId,
    user.tenantId,
  );

  return membership?.tenantRole ?? user.role;
}
