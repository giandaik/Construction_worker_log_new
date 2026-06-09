import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import mongoose from "mongoose";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { setSessionCookie, validateJWTSecret } from "@/utils/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await dbConnect();
    const db = mongoose.connection;
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email });

    if (!user || !user.password || !(await compare(password, user.password))) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
    
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create JWT token
    const jwtSecret = validateJWTSecret();
    const token = await new SignJWT({ userId: user._id.toString(), role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(jwtSecret));

    const response = NextResponse.json({
      message: "Logged in successfully",
      user: {
        _id: user._id?.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    setSessionCookie(response, token);

    return response;
  } catch (error) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { error: "Failed to login" },
      { status: 500 }
    );
  }
}


