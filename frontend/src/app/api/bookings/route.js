
// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// Import cookies to access the user's authentication token.
import { cookies } from "next/headers";

// Make sure this route handles requests dynamically.
export const dynamic = "force-dynamic";

// Set the Express backend URL for booking requests.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Define the session durations that students can select.
const allowedDurations = new Set(["30", "60", "90"]);

// Check whether the selected booking date is valid.
function validDate(value) {
  // Make sure the date follows the YYYY-MM-DD format.
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  // Convert the date into a JavaScript Date object.
  const date = new Date(`${value}T00:00:00Z`);

  // Make sure the date exists and matches the original value.
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Check whether the selected session time is valid.
function validTime(value) {
  // Accept times in the 24-hour HH:MM format.
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

// Safely read a JSON response from the Express backend.
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

// Handle requests from students who want to book tutoring sessions.
export async function POST(request) {
  try {
    // 1. Retrieve authentication token.
    // Read the user's login token from the stored cookie.
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    // Require the user to log in before requesting a session.
    if (!token) {
      return NextResponse.json(
        { error: "Log in to request a session." },
        { status: 401 }
      );
    }

    // 2. Verify authentication through Express.
    // Send the token to the backend to confirm the user's identity.
    const authResponse = await fetch(
      `${API_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    // Read the authentication response from the backend.
    const authData = await readJSON(authResponse);

    // Ask the user to log in again if their session has expired.
    if (authResponse.status === 401) {
      return NextResponse.json(
        {
          error:
            "Your session has expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    // Handle errors when the backend cannot verify the account.
    if (!authResponse.ok || !authData) {
      return NextResponse.json(
        { error: "Unable to verify your account." },
        { status: 502 }
      );
    }

    // Get the authenticated user's account information.
    const user = authData.user;

    // Reject the request if no user information is returned.
    if (!user) {
      return NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 }
      );
    }

    // Allow only student accounts to request tutoring sessions.
    if (user.role !== "student") {
      return NextResponse.json(
        {
          error:
            "Only student accounts can request sessions.",
        },
        { status: 403 }
      );
    }

    // 3. Read booking form data.
    // Try to read the session details submitted by the student.
    let body;

    try {
      body = await request.json();
    } catch {
      // Return an error if the submitted data is not valid JSON.
      return NextResponse.json(
        { error: "Invalid booking request." },
        { status: 400 }
      );
    }

    // Get the ID of the tutor selected by the student.
    const tutorID = String(
      body?.tutorID ?? ""
    ).trim();

    // Get the selected availability slot ID.
    const slotID = String(
      body?.slotID ?? ""
    ).trim();

    // Get the subject the student wants to study.
    const subjectID = String(
      body?.subjectID ?? ""
    ).trim();

    // Get the selected date for the tutoring session.
    const date = String(
      body?.date ?? ""
    ).trim();

    // Get the selected starting time for the session.
    const startTime = String(
      body?.startTime ?? ""
    ).trim();

    // Get the length of the tutoring session.
    const duration = String(
      body?.duration ?? ""
    ).trim();

    // Get the student's optional note and limit it to 500 characters.
    const note =
      typeof body?.note === "string"
        ? body.note.trim().slice(0, 500)
        : "";

    // 4. Validate booking details.
    // Make sure all required booking information is provided correctly.
    if (
      !/^\d+$/.test(tutorID) ||
      !/^\d+$/.test(slotID) ||
      !subjectID ||
      !validDate(date) ||
      !validTime(startTime) ||
      !allowedDurations.has(duration)
    ) {
      return NextResponse.json(
        {
          error:
            "Please complete all booking details correctly.",
        },
        { status: 400 }
      );
    }

    // 5. Forward validated request to Express.
    // Send the booking details and authentication token to the backend.
    const response = await fetch(
      `${API_URL}/api/bookings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tutorID,
          slotID,
          subjectID,
          date,
          startTime,
          duration,
          note,
        }),
        cache: "no-store",
      }
    );

    // Read the booking response returned by the backend.
    const data = await readJSON(response);

    // 6. Handle backend errors.
    // Return an appropriate error if the booking cannot be created.
    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            data?.error ||
            data?.message ||
            "Unable to create booking.",
        },
        { status: response.status }
      );
    }

    // Handle cases where the backend returns an invalid response.
    if (!data) {
      return NextResponse.json(
        {
          error:
            "Booking service returned an invalid response.",
        },
        { status: 502 }
      );
    }

    // 7. Return successful booking.
    // Send the successful booking information back to the frontend.
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    // Log any unexpected errors during the booking process.
    console.error("Booking API error:", error);

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
