import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

const allowedFilters = [
  "page",
  "limit",
  "search",
  "status",
  "sessionStatus",
  "paymentStatus"
];

const recordFields = [
  "id",
  "studentId",
  "tutorId",
  "studentName",
  "tutorName",
  "subject",
  "date",
  "startTime",
  "durationMinutes",
  "status",
  "totalPriceCents",
  "currency",
  "paymentStatus",
  "sessionStatus",
  "createdAt"
];

function reply(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(error, status) {
  return reply({ success: false, error }, status);
}

// Return only the monitoring fields required by the dashboard.
function selectFields(record, fields) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("Invalid monitoring record.");
  }

  return Object.fromEntries(
    fields.map(field => {
      if (!Object.hasOwn(record, field)) {
        throw new Error("Missing monitoring field.");
      }

      return [field, record[field]];
    })
  );
}

// Retrieve monitoring information through the protected backend.
export async function GET(request) {
  try {
    const token = (await cookies())
      .get("tulinkup_token")?.value;

    if (!token) {
      return fail("Sign in required.", 401);
    }

    const incoming = new URL(request.url).searchParams;
    const query = new URLSearchParams();

    for (const [key, value] of incoming) {
      if (!allowedFilters.includes(key) || query.has(key)) {
        return fail("Invalid monitoring filters.", 400);
      }

      query.set(key, value);
    }

    const response = await fetch(
      API_URL + "/api/admin/bookings?" + query.toString(),
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(18000),
      }
    );

    if (!response.ok) {
      const status = [400, 401, 403, 429].includes(response.status)
        ? response.status
        : 503;

      return fail("Unable to retrieve monitoring information.", status);
    }

    const data = await response.json();

    if (
      data?.success !== true ||
      !Array.isArray(data.bookings) ||
      data.bookings.length > 100
    ) {
      return fail("Invalid monitoring response.", 502);
    }

    try {
      const records = data.bookings.map(record =>
        selectFields(record, recordFields)
      );

      const pagination = selectFields(data.pagination, [
        "page",
        "limit",
        "total",
        "totalPages",
        "hasNextPage",
        "hasPreviousPage",
      ]);

      return reply({
        success: true,
        bookings: records,
        pagination,
      });
    } catch {
      return fail("Invalid monitoring response.", 502);
    }
  } catch {
    return fail("Monitoring is temporarily unavailable.", 503);
  }
}
