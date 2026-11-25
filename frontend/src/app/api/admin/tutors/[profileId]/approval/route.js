import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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

// Submit an approval decision without exposing the login token.
export async function PATCH(request, { params }) {
  try {
    const token = (await cookies())
      .get("tulinkup_token")?.value;

    if (!token) {
      return reply({ error: "Sign in required." }, 401);
    }

    // Accept approval changes only from the same application origin.
    if (
      request.headers.get("origin") !==
      new URL(request.url).origin
    ) {
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

    const { profileId } = await params;

    if (
      !/^[1-9]\d{0,18}$/.test(profileId) ||
      BigInt(profileId) > 9223372036854775807n
    ) {
      return reply({ error: "Invalid tutor profile." }, 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return reply({ error: "Invalid approval request." }, 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 3 ||
      !["approved", "rejected"].includes(body.status) ||
      !["pending", "approved", "rejected"].includes(body.expectedStatus) ||
      body.status === body.expectedStatus ||
      !reasons.has(body.reason)
    ) {
      return reply({ error: "Invalid approval decision." }, 400);
    }

    const response = await fetch(
      API_URL + "/api/admin/tutors/" + profileId + "/approval",
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
        400: "Invalid approval decision.",
        401: "Your session has expired.",
        403: "Administrator access required.",
        404: "Tutor profile not found.",
        409: "Tutor status has changed. Refresh before trying again.",
      };

      return reply(
        {
          error: messages[response.status] ||
            "Unable to confirm the approval outcome. Refresh before retrying.",
        },
        response.status
      );
    }

    const data = await response.json();

    if (
      data.success !== true ||
      String(data.approval?.profileId) !== profileId ||
      data.approval?.approvalStatus !== body.status ||
      data.approval?.previousStatus !== body.expectedStatus
    ) {
      return reply(
        { error: "Approval outcome requires verification. Refresh before retrying." },
        502
      );
    }

    return reply(data);
  } catch {
    return reply(
      { error: "Unable to confirm the approval outcome. Refresh before retrying." },
      503
    );
  }
}
