import type { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/errorHandling';
import { RepositoryFactory } from '@/lib/repositories';
import { isSuperAdminRole } from '@/lib/constants/roles';
import type { User } from '@/lib/repositories/UserRepository';

/**
 * Why a user may not be added to a tenant, or `null` if they may.
 *
 * A tenant admin picks members by user id, and until this existed any id was
 * accepted: the id of the platform super-admin, or of another tenant's admin.
 * Adding them created a real membership, which the login flow then honours —
 * so an attacker who runs one tenant could pull an outsider's account into it
 * and read everything through their session.
 *
 * Membership is single-tenant by construction here: a user who already
 * belongs somewhere has to be released by that tenant (or invited through a
 * flow that asks them) before another one can claim them.
 */
export function membershipRefusalReason(
  targetUser: User,
  activeMembershipTenantIds: string[],
  tenantId: string,
): string | null {
  if (isSuperAdminRole(targetUser.platformRole)) {
    return 'Platform administrators cannot be added to an organisation';
  }

  const foreign = activeMembershipTenantIds.filter((id) => id !== tenantId);

  if (foreign.length > 0) {
    return 'This user already belongs to another organisation';
  }

  return null;
}

/**
 * Loads what `membershipRefusalReason` needs and applies it.
 *
 * @returns the refusal message, or `null` when the user may be added.
 */
export async function checkMembershipEligibility(
  userId: string,
  tenantId: string,
): Promise<string | null> {
  const targetUser = await RepositoryFactory.getUserRepository().findById(userId);

  if (!targetUser) {
    return 'User not found';
  }

  const memberships =
    await RepositoryFactory.getMembershipRepository().findByUser(userId);

  return membershipRefusalReason(
    targetUser,
    memberships.map((membership) => membership.tenantId.toString()),
    tenantId,
  );
}

/**
 * The response a member-management route must return instead of writing the
 * membership, or `null` when the write may go ahead.
 *
 * A malformed or unknown id is a 404; an id that belongs to someone the tenant
 * has no claim on is a 400 — the request is well-formed, the grafting is what
 * is refused.
 */
export async function membershipRefusalResponse(
  userId: string,
  tenantId: string,
): Promise<NextResponse | null> {
  let reason: string | null;

  try {
    reason = await checkMembershipEligibility(userId, tenantId);
  } catch {
    // findById throws on an id Mongo cannot cast; an uncastable id names nobody.
    return ApiError.notFound('User');
  }

  if (reason === null) {
    return null;
  }

  return reason === 'User not found'
    ? ApiError.notFound('User')
    : ApiError.badRequest(reason);
}
