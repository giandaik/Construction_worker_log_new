import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import { ApiError } from "@/lib/api/errorHandling";
import { userSchema } from "@/lib/schemas/userSchema";
import { RepositoryFactory } from "@/lib/repositories";
import { setSessionCookie, validateJWTSecret } from "@/utils/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = userSchema.safeParse(body);
    if (!parsed.success) {
      return ApiError.badRequest(
        parsed.error.issues.map((issue) => issue.message).join(", ")
      );
    }

    const { name, email, password } = parsed.data;

    return await RepositoryFactory.withUserRepository(async (userRepo) => {
      if (await userRepo.isEmailTaken(email)) {
        return ApiError.badRequest("Email is already in use");
      }

      const user = await userRepo.create({
        name,
        email,
        password: await hash(password, 12),
        role: "user",
      } as any);

      const jwtSecret = validateJWTSecret();
      const token = await new SignJWT({
        userId: user._id?.toString(),
        role: user.role,
        name: user.name,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("12h")
        .sign(new TextEncoder().encode(jwtSecret));

      const response = NextResponse.json(
        {
          message: "Account created",
          user: {
            _id: user._id?.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          },
        },
        { status: 201 }
      );

      setSessionCookie(response, token);
      return response;
    });
  } catch (error) {
    return ApiError.handle(error);
  }
}
