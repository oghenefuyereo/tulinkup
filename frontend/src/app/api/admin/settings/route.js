import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  validateAdminSettingsResponse,
} from "@/lib/adminSettingsResponse";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Keep administrator settings out of response caches.
function respond(data, status) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// Retrieve settings through the protected backend API.
export async function GET(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  if (!token) {
    return respond(
      {
        success: false,
        error: "Authentication required.",
      },
      401
    );
  }

  const query = new URL(request.url).searchParams;

  if (query.size !== 0) {
    return respond(
      {
        success: false,
        error: "Unsupported settings query.",
      },
      400
    );
  }

  let response;

  try {
    response = await fetch(
      `${API_URL}/api/admin/settings`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      }
    );
  } catch {
    return respond(
      {
        success: false,
        error: "Platform settings are temporarily unavailable.",
      },
      503
    );
  }

  if (!response.ok) {
    const errors = {
      400: "Invalid settings request.",
      401: "Authentication required.",
      403: "Administrator access required.",
      429: "Too many requests. Please try again later.",
    };

    const status = Object.hasOwn(errors, response.status)
      ? response.status
      : 503;

    return respond(
      {
        success: false,
        error: errors[status] ||
          "Platform settings are temporarily unavailable.",
      },
      status
    );
  }

  try {
    const data = await response.json();
    const validated = validateAdminSettingsResponse(data);

    return respond(validated, 200);
  } catch {
    return respond(
      {
        success: false,
        error: "Invalid platform settings response.",
      },
      502
    );
  }
}
