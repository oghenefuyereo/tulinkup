import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isTrustedAdminOrigin, validateAccountMutation } from "@/lib/adminMutationSecurity";

export const dynamic = "force-dynamic";

const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

const reasons = new Set([
  "ADMINISTRATIVE_REVIEW",
  "VERIFICATION_COMPLETED",
  "VERIFICATION_FAILED",
  "POLICY_VIOLATION",
  "SAFETY_CONCERN",
  "ACCOUNT_REQUEST",
  "ACCOUNT_RESTORED",
  "DUPLICATE_ACCOUNT",
  "PLATFORM_CONFIGURATION",
  "SCHEDULING_ISSUE",
  "SERVICE_UNAVAILABLE",
  "OTHER_ADMINISTRATIVE_REASON",
]);

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

// Submit an account status decision without exposing the login token.
export async function PATCH(request, { params }) {
  try {
    const token = (await cookies())
      .get("tulinkup_token")?.value;

    if (!token) {
      return reply({ error: "Sign in required." }, 401);
    }

    // Accept account status changes only from the same application origin.
    if (!isTrustedAdminOrigin(request)) {
      return reply({ error: "Invalid request origin." }, 403);
    }

    if (
      request.headers.get("content-type")
        ?.split(";")[0].trim().toLowerCase() !== "application/json"
    ) {
      return reply({ error: "JSON request required." }, 415);
    }

    if (new URL(request.url).search) {
      return reply({ error: "Invalid query parameters." }, 400);
    }

    const { userId } = await params;

    if (
      !/^[1-9]\d{0,18}$/.test(userId) ||
      BigInt(userId) > 9223372036854775807n
    ) {
      return reply({ error: "Invalid user account." }, 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return reply({ error: "Invalid account status request." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 3 ||
      !["active", "suspended", "removed"].includes(body.status) ||
      !["active", "suspended"].includes(body.expectedStatus) ||
      body.status === body.expectedStatus ||
      (body.expectedStatus === "active" &&
        !["suspended", "removed"].includes(body.status)) ||
      (body.expectedStatus === "suspended" &&
        !["active", "removed"].includes(body.status)) ||
      !reasons.has(body.reason)
    ) {
      return reply({ error: "Invalid account status decision." }, 400);
    }

    const response = await fetch(
      API_URL + "/api/admin/users/" + userId + "/status",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          status: body.status,
          expectedStatus: body.expectedStatus,
          reason: body.reason,
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      const messages = {
        400: "Invalid account status decision.",
        401: "Your session has expired.",
        403: "Administrator access required.",
        404: "User account not found.",
        409: "Account status has changed. Refresh before trying again.",
      };

      return reply(
        {
          error: messages[response.status] ||
            "Unable to confirm the account status outcome. Refresh before retrying.",
        },
        response.status
      );
    }

    try {
      const data = await response.json();

      return reply(
        validateAccountMutation(data, userId, body)
      );
    } catch {
      return reply(
        {
          error: "The outcome requires verification. Refresh before retrying.",
        },
        502
      );
    }
  } catch {
    return reply(
      { error: "Unable to confirm the account status outcome. Refresh before retrying." },
      503
    );
  }
}
