import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errorHandling";
import { RepositoryFactory } from "@/lib/repositories";
import { getLegacyUserRole } from "@/lib/tenant/invitations";
import { getAuthUser, requireTenantId } from "@/utils/auth";

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return ApiError.unauthorized();
    }

    const tenantId = requireTenantId(authUser);
    const memberships = await RepositoryFactory.getMembershipRepository().findByTenant(tenantId);
    const userRepo = RepositoryFactory.getUserRepository();
    const users = await Promise.all(
      memberships
        .filter((membership) => membership.isActive)
        .map(async (membership) => {
          const account = await userRepo.findById(membership.userId.toString());
          return account
            ? { ...account, role: getLegacyUserRole(membership.tenantRole) }
            : null;
        }),
    );

    return ApiError.success(
      users
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map(({ _id, name, email, role }) => ({ _id, name, email, role })),
    );
  } catch (error) {
    return ApiError.handle(error);
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Direct account creation is disabled. Use the tenant invitation flow.' },
    { status: 405, headers: { Allow: 'GET' } },
  );
}
