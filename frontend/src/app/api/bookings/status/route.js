
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

const allowedStatuses = new Set([
  "accepted",
  "declined",
  "completed",
  "cancelled",
]);

async function readJSON(response) {
  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    // 1. Retrieve the authentication token.
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Sign in to manage bookings." },
        { status: 401 }
      );
    }

    // 2. Read the booking update request.
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid booking update request." },
        { status: 400 }
      );
    }

    const id = String(body?.id ?? "").trim();
    const status = String(body?.status ?? "").trim();

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

    const data = await readJSON(response);

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

    if (!data) {
      return NextResponse.json(
        {
          error: "Booking service returned an invalid response.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Booking status API error:", error);

    return NextResponse.json(
      {
        error:
          "Booking service is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}
