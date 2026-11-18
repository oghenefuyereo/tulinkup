
// Import Next.js response handling and cookies.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Set the Express backend URL.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Retrieve the logged-in tutor's teaching schedule.
export async function GET() {
  try {
    const cookieStore = await cookies();

    // Retrieve the authentication token.
    const token =
      cookieStore.get("tulinkup_token")?.value;

    // Require the user to sign in.
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Please sign in first.",
        },
        { status: 401 }
      );
    }

    // Retrieve availability from the Express backend.
    const response = await fetch(
      `${API_URL}/api/availability/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    // Read the response safely.
    const responseText = await response.text();

    // Handle empty backend responses.
    if (!responseText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "The backend returned an empty response.",
        },
        { status: 502 }
      );
    }

    // Convert the response into JSON.
    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "The backend returned invalid JSON.",
        },
        { status: 502 }
      );
    }

    // Return the tutor's availability.
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Get availability API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to connect to the availability service.",
      },
      { status: 502 }
    );
  }
}
