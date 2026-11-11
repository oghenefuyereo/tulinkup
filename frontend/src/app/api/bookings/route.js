
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

const allowedDurations = new Set(["30", "60", "90"]);

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validTime(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

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
    // 1. Retrieve authentication token.
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Log in to request a session." },
        { status: 401 }
      );
    }

    // 2. Verify authentication through Express.
    const authResponse = await fetch(
      `${API_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const authData = await readJSON(authResponse);

    if (authResponse.status === 401) {
      return NextResponse.json(
        {
          error:
            "Your session has expired. Please log in again.",
        },
        { status: 401 }
      );
    }

    if (!authResponse.ok || !authData) {
      return NextResponse.json(
        { error: "Unable to verify your account." },
        { status: 502 }
      );
    }

    const user = authData.user;

    if (!user) {
      return NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 }
      );
    }

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
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid booking request." },
        { status: 400 }
      );
    }

    const tutorID = String(
      body?.tutorID ?? ""
    ).trim();

    const slotID = String(
      body?.slotID ?? ""
    ).trim();

    const subjectID = String(
      body?.subjectID ?? ""
    ).trim();

    const date = String(
      body?.date ?? ""
    ).trim();

    const startTime = String(
      body?.startTime ?? ""
    ).trim();

    const duration = String(
      body?.duration ?? ""
    ).trim();

    const note =
      typeof body?.note === "string"
        ? body.note.trim().slice(0, 500)
        : "";

    // 4. Validate booking details.
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

    const data = await readJSON(response);

    // 6. Handle backend errors.
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
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Booking API error:", error);

    return NextResponse.json(
      {
        error:
          "Booking service is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}
