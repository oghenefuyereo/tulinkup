
// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// TuLinkUp logout API
// Handle logout requests by clearing the user's authentication cookie.
export async function POST() {
  try {
    // Create a response confirming that the user has logged out.
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully"
    });

    // Remove authentication cookie
    // Clear the login token by setting an empty value and zero expiration time.
    response.cookies.set("tulinkup_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    // Send the successful logout response to the frontend.
    return response;

  } catch (error) {
    // Log any unexpected errors that happen during logout.
    console.error("TuLinkUp logout error:", error);

    // Return an error response if the logout process fails.
    return NextResponse.json(
      {
        success: false,
        error: "Logout failed"
      },
      { status: 500 }
    );
  }
}
