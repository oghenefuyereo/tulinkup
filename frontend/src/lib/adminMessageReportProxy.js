import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  validateMessageReportResponse,
} from "@/lib/adminMessageReportResponse";

import {
  isTrustedAdminOrigin,
} from "@/lib/adminMutationSecurity";

const API_URL = (
  process.env.API_URL || "http://localhost:5001"
).replace(/\/+$/, "");

const STATUSES = new Set([
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
]);

const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "inappropriate_content",
  "safety_concern",
  "payment_solicitation",
  "other",
]);

const DECISION_REASONS = new Set([
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

const TRANSITIONS = new Set([
  "pending:reviewing",
  "reviewing:resolved",
  "reviewing:dismissed",
]);

const FILTERS = new Set([
  "page",
  "limit",
  "status",
  "reason",
  "search",
]);

function reply(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function failure(error, status, code) {
  return reply({
    success: false,
    error,
    ...(code ? { code } : {}),
  }, status);
}

export function validReportId(value) {
  return (
    typeof value === "string" &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

export function validateReportQuery(query) {
  const seen = new Set();

  for (const [key, value] of query.entries()) {
    if (!FILTERS.has(key) || seen.has(key)) {
      throw new Error("Invalid report filter.");
    }

    seen.add(key);

    if (key === "page" || key === "limit") {
      const max = key === "page" ? 100000 : 100;

      if (
        !/^[1-9][0-9]*$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) > max
      ) {
        throw new Error("Invalid pagination.");
      }
    }

    if (
      key === "status" &&
      value !== "" &&
      !STATUSES.has(value)
    ) {
      throw new Error("Invalid report status.");
    }

    if (
      key === "reason" &&
      value !== "" &&
      !REPORT_REASONS.has(value)
    ) {
      throw new Error("Invalid report reason.");
    }

    if (
      key === "search" &&
      (
        value.includes("\u0000") ||
        Array.from(value).length > 100
      )
    ) {
      throw new Error("Invalid search.");
    }
  }

  return query;
}

export function validateReportDecision(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    throw new Error("Invalid report decision.");
  }

  const fields = [
    "status",
    "expectedStatus",
    "reason",
  ];

  const keys = Reflect.ownKeys(body);

  if (
    keys.length !== fields.length ||
    keys.some(key => !fields.includes(key))
  ) {
    throw new Error("Invalid decision fields.");
  }

  const result = {};

  for (const key of fields) {
    const descriptor =
      Object.getOwnPropertyDescriptor(body, key);

    if (
      !descriptor ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value") ||
      typeof descriptor.value !== "string"
    ) {
      throw new Error("Invalid decision value.");
    }

    result[key] = descriptor.value;
  }

  if (
    !STATUSES.has(result.status) ||
    !STATUSES.has(result.expectedStatus) ||
    !DECISION_REASONS.has(result.reason)
  ) {
    throw new Error("Invalid report decision.");
  }

  return result;
}

function backendFailure(status, mutation) {
  const messages = {
    400: "Invalid message report request.",
    401: "Your session has expired.",
    403: "Administrator access required.",
    404: "Message report not found.",
    409: "Report status has changed or the transition is not permitted. Refresh before retrying.",
    415: "JSON request required.",
    429: "Too many requests. Try again later.",
  };

  if (Object.hasOwn(messages, status)) {
    return failure(messages[status], status);
  }

  return failure(
    mutation
      ? "Unable to confirm the decision outcome. Refresh before retrying."
      : "Message reports are temporarily unavailable.",
    503,
    mutation ? "REPORT_OUTCOME_UNCERTAIN" : undefined
  );
}

export async function proxyMessageReport(
  request,
  operation,
  params
) {
  const mutation = operation === "decision";

  try {
    const token = (await cookies())
      .get("tulinkup_token")?.value;

    if (!token) {
      return failure("Sign in required.", 401);
    }

    if (
      !["statistics", "list", "details", "decision"]
        .includes(operation)
    ) {
      return failure("Unsupported operation.", 400);
    }

    const query = new URL(request.url).searchParams;

    let endpoint = "/api/admin/message-reports";
    let body;
    let reportId;

    if (operation === "list") {
      try {
        validateReportQuery(query);
      } catch {
        return failure("Invalid report filters.", 400);
      }

      if (query.size > 0) {
        endpoint += "?" + query.toString();
      }
    } else if (query.size > 0) {
      return failure("Invalid query parameters.", 400);
    }

    if (operation === "statistics") {
      endpoint += "/statistics";
    }

    if (
      operation === "details" ||
      operation === "decision"
    ) {
      const { id } = await params;

      if (!validReportId(id)) {
        return failure("Invalid message report ID.", 400);
      }

      reportId = id;
      endpoint += "/" + id;
    }

    if (mutation) {
      if (!isTrustedAdminOrigin(request)) {
        return failure("Invalid request origin.", 403);
      }

      if (
        request.headers.get("content-type")
          ?.split(";")[0].trim().toLowerCase()
          !== "application/json"
      ) {
        return failure("JSON request required.", 415);
      }

      try {
        body = validateReportDecision(
          await request.json()
        );
      } catch {
        return failure("Invalid report decision.", 400);
      }

      if (
        !TRANSITIONS.has(
          body.expectedStatus + ":" + body.status
        )
      ) {
        return failure(
          "This report status transition is not permitted.",
          409,
          "INVALID_REPORT_TRANSITION"
        );
      }

      endpoint += "/status";
    }

    const response = await fetch(API_URL + endpoint, {
      method: mutation ? "PATCH" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        ...(mutation
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(mutation
        ? { body: JSON.stringify(body) }
        : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(
        mutation ? 30000 : 20000
      ),
    });

    if (!response.ok) {
      return backendFailure(response.status, mutation);
    }

    try {
      const data = await response.json();

      return reply(
        validateMessageReportResponse(
          data,
          operation,
          {
            query,
            id: reportId,
            body,
          }
        )
      );
    } catch {
      return failure(
        mutation
          ? "The decision outcome requires verification. Refresh before retrying."
          : "Invalid message report response.",
        502,
        mutation ? "REPORT_OUTCOME_UNCERTAIN" : undefined
      );
    }
  } catch {
    return failure(
      mutation
        ? "Unable to confirm the decision outcome. Refresh before retrying."
        : "Message reports are temporarily unavailable.",
      503,
      mutation ? "REPORT_OUTCOME_UNCERTAIN" : undefined
    );
  }
}
