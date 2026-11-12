
// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// Import cookies to access the user's stored authentication token.
import { cookies } from "next/headers";

// Check whether the current user is logged in and return their account details.
export async function GET() {
  try {
    // Read the cookies stored with the incoming request.
    const cookieStore = await cookies();

    // Get the user's authentication token from the cookie.
    const token = cookieStore.get("tulinkup_token")?.value;

    // Return a null user if no authentication token is found.
    if (!token) {
      return NextResponse.json({ user: null });
    }

    // Send the token to the Express backend to verify the user's login.
    const response = await fetch(
      `${process.env.API_URL || "http://localhost:5001"}/api/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    // Return an error if the backend cannot verify the user.
    if (!response.ok) {
      return NextResponse.json(
        { user: null },
        { status: response.status === 401 ? 401 : 502 }
      );
    }

    // Read the user information returned by the backend.
    const data = await response.json();
    const user = data.user;

    // Return a null user if the backend does not provide user details.
    if (!user) {
      return NextResponse.json({ user: null });
    }

    // Send the verified user's ID, name, and role to the frontend.
    return NextResponse.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    // Log any unexpected errors during authentication.
    console.error("TuLinkUp authentication error:", error);

    // Return an error if the authentication check cannot be completed.
    return NextResponse.json(
      { error: "Unable to verify authentication." },
      { status: 500 }
    );
  }
}
