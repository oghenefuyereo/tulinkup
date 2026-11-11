
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:5001";

async function forwardRequest(method, request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Tutor sign-in required." },
        { status: 401 }
      );
    }

    const authResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();

    if (authData.user?.role !== "tutor") {
      return NextResponse.json(
        { error: "Tutor account required." },
        { status: 403 }
      );
    }

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    };

    if (method !== "GET") {
      options.body = JSON.stringify(await request.json());
    }

    const response = await fetch(
      `${API_URL}/api/availability`,
      options
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Availability API error:", error);

    return NextResponse.json(
      { error: "Availability service is unavailable." },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return forwardRequest("GET", request);
}

export async function POST(request) {
  return forwardRequest("POST", request);
}

export async function DELETE(request) {
  return forwardRequest("DELETE", request);
}
