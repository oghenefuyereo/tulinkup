
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Forward update and delete requests to Express.
async function manageAvailability(
  request,
  context,
  method
) {
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

    // Retrieve the dynamic availability ID.
    const { id } = await context.params;

    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: "Invalid availability ID." },
        { status: 400 }
      );
    }

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    };

    // Only update requests require a request body.
    if (method === "PUT") {
      const body = await request.json();

      options.body = JSON.stringify(body);
    }

    const response = await fetch(
      `${API_URL}/api/availability/${id}`,
      options
    );

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Manage availability error:", error);

    return NextResponse.json(
      { error: "Unable to manage availability." },
      { status: 502 }
    );
  }
}

// Update an existing availability slot.
export async function PUT(request, context) {
  return manageAvailability(
    request,
    context,
    "PUT"
  );
}

// Delete an existing availability slot.
export async function DELETE(request, context) {
  return manageAvailability(
    request,
    context,
    "DELETE"
  );
}
