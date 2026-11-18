
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Create a new availability slot.
export async function POST(request) {
  try {
    const cookieStore = await cookies();

    const token =
      cookieStore.get("tulinkup_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(
      `${API_URL}/api/availability`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Create availability API error:", error);

    return NextResponse.json(
      { error: "Unable to create availability." },
      { status: 502 }
    );
  }
}
