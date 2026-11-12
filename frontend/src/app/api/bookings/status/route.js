
// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// Import cookies to access the user's authentication token.
import { cookies } from "next/headers";

// Make sure this route handles requests dynamically.
export const dynamic = "force-dynamic";

// Set the Express backend URL for booking requests.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Define the booking statuses that users can submit.
const allowedStatuses = new Set([
  "accepted",
  "declined",
  "completed",
  "cancelled",
]);

// Safely read a JSON response from the backend.
async function readJSON(response) {
  // Check the type of content returned by the backend.
  const contentType =
    response.headers.get("content-type") || "";

  // Return null if the response is not JSON.
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    // Convert the JSON response into a JavaScript object.
    return await response.json();
  } catch {
    // Return null if the response cannot be read.
    return null;
  }
}

// Handle requests to update the status of an existing booking.
export async function POST(request) {
  try {
    // 1. Retrieve the authentication token.
    // Read the user's login token from the stored cookie.
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    // Require the user to sign in before managing bookings.
    if (!token) {
      return NextResponse.json(
        { error: "Sign in to manage bookings." },
        { status: 401 }
      );
    }

    // 2. Read the booking update request.
    // Try to read the booking information submitted by the frontend.
    let body;

    try {
      body = await request.json();
    } catch {
      // Reject the request if the submitted data is not valid JSON.
      return NextResponse.json(
        { error: "Invalid booking update request." },
        { status: 400 }
      );
    }

    // Get the booking ID and the requested new status.
    const id = String(body?.id ?? "").trim();
    const status = String(body?.status ?? "").trim();

    // Make sure the booking ID is numeric and the status is allowed.
    if (
      !/^\d+$/.test(id) ||
      !allowedStatuses.has(status)
    ) {
      return NextResponse.json(
        { error: "Invalid booking update." },
        { status: 400 }
      );
    }

    // 3. Forward the status update to Express.
    // Send the booking ID, new status, and login token to the backend.
    const response = await fetch(
      `${API_URL}/api/bookings/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
        cache: "no-store",
      }
    );

    // Read the response returned by the Express backend.
    const data = await readJSON(response);

    // Return the backend error if the booking update fails.
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error ||
            data?.message ||
            "Unable to update booking.",
        },
        { status: response.status }
      );
    }

    // Handle cases where the backend returns an unexpected response.
    if (!data) {
      return NextResponse.json(
        {
          error: "Booking service returned an invalid response.",
        },
        { status: 502 }
      );
    }

    // Send the successful booking update response to the frontend.
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    // Log any unexpected errors during the booking update.
    console.error("Booking status API error:", error);

    // Return an error if the booking service is unavailable.
    return NextResponse.json(
      {
        error:
          "Booking service is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}
