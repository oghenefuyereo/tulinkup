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
const allowedDurations = new Set([30, 60, 90]);

// Define the platform's maximum private tutoring hourly rate.
const MAX_HOURLY_RATE_CENTS = 2500;

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

// Verify the pricing information returned by the backend.
function hasValidBookingPricing(booking) {
  if (
    !booking ||
    typeof booking !== "object"
  ) {
    return false;
  }

  // Get the pricing information stored in the booking.
  const {
    hourly_rate_cents,
    total_price_cents,
    platform_commission_cents,
    tutor_earnings_cents,
    currency,
    payment_status,
  } = booking;

  // Make sure all monetary values are valid Canadian cents.
  const amounts = [
    hourly_rate_cents,
    total_price_cents,
    platform_commission_cents,
    tutor_earnings_cents,
  ];

  if (
    amounts.some(
      (amount) =>
        !Number.isSafeInteger(amount) ||
        amount < 0
    )
  ) {
    return false;
  }

  // Make sure the hourly rate follows the platform pricing limit.
  if (
    hourly_rate_cents > MAX_HOURLY_RATE_CENTS ||
    currency !== "CAD"
  ) {
    return false;
  }

  // Make sure the revenue allocation matches the session price.
  if (
    platform_commission_cents +
      tutor_earnings_cents !==
    total_price_cents
  ) {
    return false;
  }

  // Verify that the booking has a supported payment status.
  if (
    ![
      "not_required",
      "unpaid",
      "pending",
      "paid",
      "failed",
      "refunded",
    ].includes(payment_status)
  ) {
    return false;
  }

  // Free bookings must not require payment.
  if (total_price_cents === 0) {
    return payment_status === "not_required";
  }

  // Paid bookings must have a payment-related status.
  return payment_status !== "not_required";
}

// Handle requests from students who want to book tutoring sessions.
export async function POST(request) {
  try {
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

    // Send the token to the backend to confirm the user's identity.
    const authResponse = await fetch(
      `${API_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
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

    // Prevent unauthorized users from requesting bookings.
    if (authResponse.status === 403) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
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

    // Make sure the submitted booking data is an object.
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid booking request." },
        { status: 400 }
      );
    }

    // Get the ID of the tutor selected by the student.
    const tutorID = String(
      body.tutorID ?? ""
    ).trim();

    // Get the selected availability slot ID.
    const slotID = String(
      body.slotID ?? ""
    ).trim();

    // Get the subject the student wants to study.
    const subjectID =
      typeof body.subjectID === "string"
        ? body.subjectID.trim()
        : "";

    // Get the selected date for the tutoring session.
    const date = String(
      body.date ?? ""
    ).trim();

    // Get the selected starting time for the session.
    const startTime = String(
      body.startTime ?? ""
    ).trim();

    // Convert the session duration into minutes.
    const duration = Number(body.duration);

    // Get the student's optional learning note.
    const note = body.note ?? "";

    // Make sure all required booking information is provided correctly.
    if (
      !/^[1-9]\d*$/.test(tutorID) ||
      !/^[1-9]\d*$/.test(slotID) ||
      !subjectID ||
      subjectID.length > 150 ||
      !validDate(date) ||
      !validTime(startTime) ||
      !allowedDurations.has(duration) ||
      typeof note !== "string" ||
      note.length > 500
    ) {
      return NextResponse.json(
        {
          error:
            "Please complete all booking details correctly.",
        },
        { status: 400 }
      );
    }

    // Send only the validated booking details to the backend.
    // The backend retrieves the tutor's rate and calculates the price.
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
          note: note.trim(),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      }
    );

    // Read the booking response returned by the backend.
    const data = await readJSON(response);

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

    // Make sure the backend confirmed that the booking was created.
    if (
      !data ||
      data.success !== true ||
      !data.booking ||
      !data.booking.id
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to confirm your booking. Check your student dashboard before submitting another request.",
        },
        { status: 502 }
      );
    }

    // Verify the pricing information returned by the backend.
    if (!hasValidBookingPricing(data.booking)) {
      console.error(
        "Invalid pricing returned for booking:",
        data.booking.id
      );

      return NextResponse.json(
        {
          error:
            "Your booking was submitted, but its pricing information could not be verified. Check your student dashboard before submitting another request.",
        },
        { status: 502 }
      );
    }

    // Return the booking and its stored pricing information.
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    // Log any unexpected errors during the booking process.
    console.error("Booking API error:", error);

    // Handle requests that take too long to complete.
    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return NextResponse.json(
        {
          error:
            "The booking service took too long to respond. Check your student dashboard before submitting another request.",
        },
        { status: 504 }
      );
    }

    // Return an error if the booking service is unavailable.
    return NextResponse.json(
      {
        error:
          "Booking service is temporarily unavailable. Check your dashboard before trying again.",
      },
      { status: 503 }
    );
  }
}