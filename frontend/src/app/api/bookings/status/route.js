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

// Define the payment statuses supported by the platform.
const allowedPaymentStatuses = new Set([
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
  "not_required",
]);

// Safely read a JSON response from the backend.
async function readJSON(response) {
  const contentType =
    response.headers.get("content-type") || "";

  // Return null if the response is not JSON.
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Check the pricing information returned with a booking.
function hasValidBookingPricing(booking) {
  const hourlyRate =
    booking.hourlyRateCents ??
    booking.hourly_rate_cents ??
    null;

  const totalPrice =
    booking.totalPriceCents ??
    booking.total_price_cents ??
    null;

  const commission =
    booking.platformCommissionCents ??
    booking.platform_commission_cents ??
    null;

  const tutorEarnings =
    booking.tutorEarningsCents ??
    booking.tutor_earnings_cents ??
    null;

  const paymentStatus =
    booking.paymentStatus ??
    booking.payment_status ??
    null;

  // Keep older bookings that were created before pricing was introduced.
  const amounts = [
    hourlyRate,
    totalPrice,
    commission,
    tutorEarnings,
  ];

  if (
    amounts.every((amount) => amount === null) &&
    paymentStatus === null
  ) {
    return true;
  }

  // Make sure all pricing amounts are valid integers.
  if (
    amounts.some(
      (amount) =>
        !Number.isSafeInteger(amount) ||
        amount < 0
    )
  ) {
    return false;
  }

  // Make sure the booking follows the platform pricing rules.
  if (
    hourlyRate > 2500 ||
    booking.currency !== "CAD"
  ) {
    return false;
  }

  // Make sure the stored revenue split matches the session price.
  if (commission + tutorEarnings !== totalPrice) {
    return false;
  }

  // Check that the booking has a supported payment status.
  if (!allowedPaymentStatuses.has(paymentStatus)) {
    return false;
  }

  // Free sessions do not require payment.
  if (totalPrice === 0) {
    return paymentStatus === "not_required";
  }

  // Paid sessions must have a payment-related status.
  return paymentStatus !== "not_required";
}

// Handle requests to update the status of an existing booking.
export async function POST(request) {
  try {
    // Read the user's login token from the stored cookie.
    const cookieStore = await cookies();
    const token =
      cookieStore.get("tulinkup_token")?.value;

    // Require the user to sign in before managing bookings.
    if (!token) {
      return NextResponse.json(
        { error: "Sign in to manage bookings." },
        { status: 401 }
      );
    }

    // Read the booking information submitted by the frontend.
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid booking update request." },
        { status: 400 }
      );
    }

    // Make sure the submitted booking information is valid.
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid booking update request." },
        { status: 400 }
      );
    }

    // Get the booking ID and requested status.
    const id = String(body.id ?? "").trim();

    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : "";

    // Make sure the booking ID and requested status are valid.
    if (
      !/^[1-9]\d*$/.test(id) ||
      !allowedStatuses.has(status)
    ) {
      return NextResponse.json(
        { error: "Invalid booking update." },
        { status: 400 }
      );
    }

    // Send only the requested booking status to the backend.
    // Pricing and payment information are managed by the backend.
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
        signal: AbortSignal.timeout(30000),
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

    // Make sure the backend confirmed the booking update.
    if (
      !data ||
      data.success !== true ||
      !data.booking ||
      String(data.booking.id) !== id ||
      data.booking.status !== status
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to confirm the booking update. Refresh your dashboard before trying again.",
        },
        { status: 502 }
      );
    }

    // Check the pricing information returned by the backend.
    if (!hasValidBookingPricing(data.booking)) {
      console.error(
        "Invalid pricing returned for booking:",
        id
      );

      return NextResponse.json(
        {
          error:
            "The booking was updated, but its pricing information could not be verified. Refresh your dashboard.",
        },
        { status: 502 }
      );
    }

    // Return the updated booking and its stored pricing information.
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    // Log any unexpected errors during the booking update.
    console.error("Booking status API error:", error);

    // Handle requests that take too long to complete.
    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return NextResponse.json(
        {
          error:
            "The booking service took too long to respond. Refresh your dashboard before trying again.",
        },
        { status: 504 }
      );
    }

    // Return an error if the booking service is unavailable.
    return NextResponse.json(
      {
        error:
          "Booking service is temporarily unavailable. Refresh your dashboard before trying again.",
      },
      { status: 503 }
    );
  }
}