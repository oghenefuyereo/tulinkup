
// Import Next.js response handling.
import { NextResponse } from "next/server";

// Set the Express backend URL.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Retrieve registered tutors from the Express backend.
export async function GET() {
  try {
    const response = await fetch(
      `${API_URL}/api/tutors`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    // Ensure the backend returned JSON.
    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Backend returned an unexpected response.",
        },
        { status: 502 }
      );
    }

    // Retrieve the tutor information.
    const data = await response.json();

    // Return the backend response to the frontend.
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Tutor marketplace API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to connect to the tutor service.",
      },
      { status: 502 }
    );
  }
}
