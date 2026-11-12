
// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// Define a pattern to check whether an email address is valid.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Handle login requests sent from the frontend.
export async function POST(request) {
  try {
    // Read the login information submitted by the user.
    const body = await request.json();

    // Clean up the email address and convert it to lowercase.
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    // Get the password if it was provided as a string.
    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    // Validate login details
    // Make sure the user provides a valid email and password.
    if (!emailPattern.test(email) || !password) {
      return NextResponse.json(
        { error: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    // Connect to TuLinkUp Express backend
    // Send the login details to the backend for authentication.
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

    // Read the response returned by the backend.
    const data = await response.json();

    // Handle unsuccessful login
    // Show an appropriate error if the login attempt fails.
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

    // Make sure the backend returned a token and user information.
    if (!data.token || !data.user) {
      throw new Error("Invalid backend login response");
    }

    // Preserve Figma Make frontend response format
    // Return the user's name and role in the expected format.
    const result = NextResponse.json({
      user: {
        fullName: data.user.full_name,
        role: data.user.role
      }
    });

    // Store JWT in an HTTP-only cookie
    // Keep the login token in a cookie that client-side JavaScript cannot read.
    result.cookies.set("tulinkup_token", data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60
    });

    // Send the successful login response to the frontend.
    return result;

  } catch (error) {
    // Log unexpected errors that happen during the login process.
    console.error("TuLinkUp login error:", error);

    // Return an error if the login service cannot complete the request.
    return NextResponse.json(
      { error: "Login service is temporarily unavailable." },
      { status: 500 }
    );
  }
}
