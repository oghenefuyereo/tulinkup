
import { NextResponse } from "next/server";

// TuLinkUp logout API
export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully"
    });

    // Remove authentication cookie
    response.cookies.set("tulinkup_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });

    return response;

  } catch (error) {
    console.error("TuLinkUp logout error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Logout failed"
      },
      { status: 500 }
    );
  }
}
