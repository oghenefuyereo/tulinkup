
import { NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    // Validate login details
    if (!emailPattern.test(email) || !password) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    // Connect to TuLinkUp Express backend
    const response = await fetch(
      `${process.env.API_URL || "http://localhost:5001"}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password }),
        cache: "no-store"
      }
    );

    const data = await response.json();

    // Handle unsuccessful login
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            response.status === 401
              ? "Email or password is incorrect."
              : data.message || "Unable to sign in."
        },
        { status: response.status }
      );
    }

    if (!data.token || !data.user) {
      throw new Error("Invalid backend login response");
    }

    // Preserve Figma Make frontend response format
    const result = NextResponse.json({
      user: {
        fullName: data.user.full_name,
        role: data.user.role
      }
    });

    // Store JWT in an HTTP-only cookie
    result.cookies.set("tulinkup_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60
    });

    return result;

  } catch (error) {
    console.error("TuLinkUp login error:", error);

    return NextResponse.json(
      { error: "Login service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
