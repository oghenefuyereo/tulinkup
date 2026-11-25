import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  validateAuditQuery,
  validateAdminAuditResponse,
} from "@/lib/adminAuditResponse";

export const dynamic = "force-dynamic";

const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

// Prevent protected audit information from being cached.
function reply(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function failure(message, status) {
  return reply({
    success: false,
    error: message,
  }, status);
}

// Retrieve audit records through the protected backend.
export async function GET(request) {
  try {
    const token = (await cookies())
      .get("tulinkup_token")?.value;

    if (!token) {
      return failure("Sign in required.", 401);
    }

    const query = new URL(request.url).searchParams;

    try {
      validateAuditQuery(query);
    } catch {
      return failure("Invalid audit filters.", 400);
    }

    const response = await fetch(
      API_URL + "/api/admin/audit-logs?" + query.toString(),
      {
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!response.ok) {
      const status = [400, 401, 403, 429].includes(
        response.status
      ) ? response.status : 503;

      return failure(
        "Unable to retrieve administrator audit logs.",
        status
      );
    }

    try {
      const data = await response.json();

      return reply(
        validateAdminAuditResponse(data, query)
      );
    } catch {
      return failure(
        "Invalid administrator audit response.",
        502
      );
    }
  } catch {
    return failure(
      "Administrator audit logs are temporarily unavailable.",
      503
    );
  }
}
