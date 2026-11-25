import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

function reply(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// Retrieve tutors using the authenticated administrator account.
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
      "approvalStatus",
    ];

    for (const [key, value] of incoming) {
      if (!allowed.includes(key) || query.has(key)) {
        return reply({ error: "Invalid filters." }, 400);
      }

      query.set(key, value);
    }

    const response = await fetch(
      API_URL + "/api/admin/tutors?" + query.toString(),
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
        { error: "Unable to retrieve tutors." },
        response.status
      );
    }

    const data = await response.json();

    if (data.success !== true || !Array.isArray(data.tutors)) {
      return reply({ error: "Invalid tutor response." }, 502);
    }

    return reply(data);
  } catch {
    return reply(
      { error: "Tutor management is temporarily unavailable." },
      503
    );
  }
}
