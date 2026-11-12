
// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// Define a pattern to check whether an email address is valid.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Handle new student and tutor registration requests.
export async function POST(request) {
  try {
    // Read the registration details submitted by the user.
    const body = await request.json();

    // Get the user's full name and remove extra spaces.
    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

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

    // Allow users to register as either a student or a tutor.
    const role =
      body.role === "tutor"
        ? "tutor"
        : body.role === "student"
          ? "student"
          : "";

    // Validate registration details
    // Make sure the user's full name contains at least two characters.
    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Enter your full name." },
        { status: 400 }
      );
    }

    // Check that the user entered a valid email address.
    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    // Require a password with at least eight characters.
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Make sure the user selected a student or tutor account.
    if (!role) {
      return NextResponse.json(
        { error: "Choose a student or tutor account." },
        { status: 400 }
      );
    }

    // Register through the existing Express backend
    // Use the configured backend URL or the local development server.
    const backendUrl =
      process.env.API_URL || "http://localhost:5001";

    // Send the registration information to the Express backend.
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

    // Read the registration response from the backend.
    const data = await response.json();

    // Handle registration errors, including duplicate email addresses.
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
    // Automatically sign in the user after creating their account.
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

    // Read the login information returned by the backend.
    const loginData = await loginResponse.json();

    // Make sure automatic login returned a valid token and user details.
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
    // Return the new user's name and account role to the frontend.
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
    // Keep the login token in a secure cookie for one hour.
    result.cookies.set("tulinkup_token", loginData.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60
    });

    // Send the successful registration response to the frontend.
    return result;

  } catch (error) {
    // Log any unexpected errors during the registration process.
    console.error("TuLinkUp registration error:", error);

    // Return an error if the account cannot be created.
    return NextResponse.json(
      {
        error: "We could not create your account."
      },
      { status: 500 }
    );
  }
}
