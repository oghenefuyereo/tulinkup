import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateAdminListResponse } from "../../../../lib/adminListResponse";

export const dynamic = "force-dynamic";

const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

function reply(data, status = 200) {
  // Keep error responses consistent without exposing account records.
  const payload = status >= 400
    ? {
        success: false,
        error: typeof data?.error === "string"
          ? data.error
          : "Administrator request failed.",
      }
    : data;

  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Retrieve students using the authenticated administrator account.
export async function GET(request) {
  try {
    const token = (await cookies())
      .get("tulinkup_token")?.value;

    if (!token) {
      return reply({ error: "Sign in required." }, 401);
    }

    const incoming = new URL(request.url).searchParams;
    const query = new URLSearchParams();

    const allowed = [
      "page",
      "limit",
      "search",
      "status",
    ];

    for (const [key, value] of incoming) {
      if (!allowed.includes(key) || query.has(key)) {
        return reply({ error: "Invalid filters." }, 400);
      }

      query.set(key, value);
    }

    const response = await fetch(
      API_URL + "/api/admin/students?" + query.toString(),
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      return reply(
        { error: "Unable to retrieve students." },
        [400, 401, 403, 429].includes(response.status)
          ? response.status
          : 503
      );
    }

    try {
      const data = await response.json();

      return reply(
        validateAdminListResponse(data, "students", query)
      );
    } catch {
      return reply(
        { error: "Invalid administrator response." },
        502
      );
    }
  } catch {
    return reply(
      { error: "Student management is temporarily unavailable." },
      503
    );
  }
}
