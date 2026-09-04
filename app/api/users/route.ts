import { ApiError } from "@/lib/api/errorHandling";
import { userSchema } from "@/lib/schemas/userSchema";
import { RepositoryFactory } from "@/lib/repositories";
import { getAuthUser, isAdmin, requireTenantId } from "@/utils/auth";
import { hash } from "bcryptjs";

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
        .map((membership) => userRepo.findById(membership.userId.toString())),
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

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUser(request);

    // Only admins/managers can create users
    if (!authUser || !isAdmin(authUser)) {
      return ApiError.forbidden('Only administrators can create users');
    }

    const userData = await request.json();

    // Validate user data with Zod schema
    const validatedData = userSchema.safeParse(userData);
    if (!validatedData.success) {
      return ApiError.badRequest(
        validatedData.error.issues.map(issue => issue.message).join(', ')
      );
    }

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      const { password, ...rest } = validatedData.data;
      const newUser = {
        ...rest,
        password: await hash(password, 12),
        role: rest.role || 'user',
      };

      const user = await userRepo.create(newUser as any);

      // Automatically add the new user to the creating admin's tenant
      if (authUser.tenantId) {
        const roleMap: Record<string, 'admin' | 'manager' | 'worker'> = {
          admin: 'admin',
          manager: 'manager',
          user: 'worker',
        };
        await RepositoryFactory.getMembershipRepository().upsertMembership(
          user._id!.toString(),
          authUser.tenantId,
          roleMap[rest.role ?? 'user'] ?? 'worker'
        );
      }

      return ApiError.success(user, 201);
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
