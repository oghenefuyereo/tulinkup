
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

const allowedDurations = new Set(["30", "60", "90"]);

export async function POST(request) {
  try {
    // Get the authentication token.
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Log in to request a session." },
        { status: 401 }
      );
    }

    // Verify the current user through Express.
    const authResponse = await fetch(
      `${API_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "Your session has expired. Please log in." },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();
    const user = authData.user;

    if (!user || user.role !== "student") {
      return NextResponse.json(
        {
          error: "Only student accounts can request sessions.",
        },
        { status: 403 }
      );
    }

    // Read and validate booking details.
    const body = await request.json();

    const tutorID =
      typeof body.tutorID === "string"
        ? body.tutorID.trim()
        : "";

    const subjectID =
      typeof body.subjectID === "string"
        ? body.subjectID.trim()
        : "";

    const date =
      typeof body.date === "string"
        ? body.date.trim()
        : "";

    const startTime =
      typeof body.startTime === "string"
        ? body.startTime.trim()
        : "";

    const duration = String(body.duration ?? "");

    const studentNote =
      typeof body.note === "string"
        ? body.note.trim().slice(0, 500)
        : "";

    if (
      !tutorID ||
      !subjectID ||
      !date ||
      !startTime ||
      !allowedDurations.has(duration)
    ) {
      return NextResponse.json(
        { error: "Complete all booking details." },
        { status: 400 }
      );
    }

    // Send the booking request to Express.
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
          subjectID,
          date,
          startTime,
          duration,
          note: studentNote,
        }),
        cache: "no-store",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Booking API error:", error);

    return NextResponse.json(
      { error: "Unable to create booking. Please try again." },
      { status: 500 }
    );
  }
}
