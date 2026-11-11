
import { NextResponse } from "next/server";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  try {
    const body = await request.json();

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const role =
      body.role === "tutor"
        ? "tutor"
        : body.role === "student"
          ? "student"
          : "";

    // Validate registration details
    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Enter your full name." },
        { status: 400 }
      );
    }

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "Choose a student or tutor account." },
        { status: 400 }
      );
    }

    // Register through the existing Express backend
    const backendUrl =
      process.env.API_URL || "http://localhost:5001";

    const response = await fetch(
      `${backendUrl}/api/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role
        }),
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            response.status === 409
              ? "An account with this email already exists."
              : data.message || "We could not create your account."
        },
        { status: response.status }
      );
    }

    // Log in after successful registration
    const loginResponse = await fetch(
      `${backendUrl}/api/auth/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        }),
        cache: "no-store"
      }
    );

    const loginData = await loginResponse.json();

    if (
      !loginResponse.ok ||
      !loginData.token ||
      !loginData.user
    ) {
      return NextResponse.json(
        {
          error:
            "Account created, but automatic login failed. Please sign in."
        },
        { status: 502 }
      );
    }

    // Preserve Figma Make's expected response format
    const result = NextResponse.json(
      {
        user: {
          fullName: loginData.user.full_name,
          role: loginData.user.role
        }
      },
      { status: 201 }
    );

    // Store authentication token in an HTTP-only cookie
    result.cookies.set("tulinkup_token", loginData.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60
    });

    return result;

  } catch (error) {
    console.error("TuLinkUp registration error:", error);

    return NextResponse.json(
      {
        error: "We could not create your account."
      },
      { status: 500 }
    );
  }
}
