// Import Next.js server utilities.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Retrieve the backend API URL.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Validate the classroom type and ID.
export function isValidSession(type, id) {
  return (
    ["one_on_one", "group"].includes(type) &&
    /^[1-9]\d*$/.test(String(id))
  );
}

// Return an error for invalid classroom requests.
export function invalidSession() {
  return NextResponse.json(
    {
      success: false,
      message: "Invalid session type or ID.",
    },
    { status: 400 }
  );
}

// Forward authenticated requests to the backend.
export async function liveSessionApi(
  path,
  { method = "GET", body } = {}
) {
  try {
    // Retrieve the authenticated user's cookie.
    const cookieStore = await cookies();

    const token = cookieStore.get(
      "tulinkup_token"
    )?.value;

    // Prevent unauthenticated classroom access.
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      );
    }

    // Configure the backend request headers.
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };

    // Include JSON headers when sending a request body.
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    // Send the request to the Express backend.
    const response = await fetch(
      `${API_URL.replace(/\/+$/, "")}/api/live-sessions${path}`,
      {
        method,
        headers,
        body:
          body !== undefined
            ? JSON.stringify(body)
            : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }
    );

    // Safely retrieve the backend response.
    const data = await response
      .json()
      .catch(() => null);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid classroom service response.",
        },
        { status: 502 }
      );
    }

    // Return the response without caching classroom tokens.
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "Live session API error:",
      error.message
    );

    return NextResponse.json(
      {
        success: false,
        message: "The classroom service is unavailable.",
      },
      { status: 503 }
    );
  }
}