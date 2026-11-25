import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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

// Retrieve users using the authenticated administrator account.
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
      "role",
    ];

    for (const [key, value] of incoming) {
      if (!allowed.includes(key) || query.has(key)) {
        return reply({ error: "Invalid filters." }, 400);
      }

      query.set(key, value);
    }

    const response = await fetch(
      API_URL + "/api/admin/users?" + query.toString(),
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
        { error: "Unable to retrieve users." },
        response.status
      );
    }

    const data = await response.json();

    if (data.success !== true || !Array.isArray(data.users)) {
      return reply({ error: "Invalid user response." }, 502);
    }

    return reply(data);
  } catch {
    return reply(
      { error: "User management is temporarily unavailable." },
      503
    );
  }
}
