
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Forward requests to the Express Group Classes API.
export async function groupClassApi(
  path = "",
  {
    method = "GET",
    body,
    protectedRoute = false,
  } = {}
) {
  try {
    const headers = {
      Accept: "application/json",
    };

    // Protected requests require a valid authentication cookie.
    if (protectedRoute) {
      const cookieStore = await cookies();

      const token = cookieStore.get(
        "tulinkup_token"
      )?.value;

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            message: "Please sign in first.",
          },
          { status: 401 }
        );
      }

      headers.Authorization = `Bearer ${token}`;
    }

    // Include JSON headers when sending request data.
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
      `${API_URL.replace(/\/+$/, "")}/api/group-classes${path}`,
      {
        method,
        headers,
        body:
          body !== undefined
            ? JSON.stringify(body)
            : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await response.json().catch(() => null);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid response from the backend.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("Group class API error:", error.message);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to connect to the group class service.",
      },
      { status: 503 }
    );
  }
}

// Validate class IDs before forwarding requests.
export function isValidClassId(id) {
  return /^\d+$/.test(String(id));
}

// Return an invalid class ID response.
export function invalidClassId() {
  return NextResponse.json(
    {
      success: false,
      message: "Invalid group class ID.",
    },
    { status: 400 }
  );
}

// Return an invalid request body response.
export function invalidRequestBody() {
  return NextResponse.json(
    {
      success: false,
      message: "Invalid request body.",
    },
    { status: 400 }
  );
}
