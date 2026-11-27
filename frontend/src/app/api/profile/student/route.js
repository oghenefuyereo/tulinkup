import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

const MAX_BODY_BYTES = 32768;

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function fail(message, status) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

// Prevent cross-origin profile modifications.
function isSameOrigin(request) {
  const origin = request.headers.get("origin");

  if (!origin) return false;

  try {
    return (
      new URL(origin).origin ===
      new URL(request.url).origin
    );
  } catch {
    return false;
  }
}

// Keep authentication tokens on the server.
async function getToken() {
  const cookieStore = await cookies();

  return cookieStore.get("tulinkup_token")?.value;
}

// Validate and limit the returned profile information.
function normalizeProfile(profile) {
  if (
    !profile ||
    typeof profile !== "object" ||
    Array.isArray(profile)
  ) {
    throw new Error("Invalid profile response.");
  }

  const fields = [
    "biography",
    "learningInterests",
    "education",
    "learningGoals",
  ];

  for (const field of fields) {
    if (typeof profile[field] !== "string") {
      throw new Error("Invalid profile field.");
    }
  }

  if (
    profile.displayName !== null &&
    typeof profile.displayName !== "string"
  ) {
    throw new Error("Invalid display name.");
  }

  if (typeof profile.hasProfileImage !== "boolean") {
    throw new Error("Invalid image status.");
  }

  for (const field of ["createdAt", "updatedAt"]) {
    if (
      profile[field] !== null &&
      (
        typeof profile[field] !== "string" ||
        !Number.isFinite(Date.parse(profile[field]))
      )
    ) {
      throw new Error("Invalid profile timestamp.");
    }
  }

  return {
    displayName: profile.displayName,
    biography: profile.biography,
    learningInterests: profile.learningInterests,
    education: profile.education,
    learningGoals: profile.learningGoals,
    hasProfileImage: profile.hasProfileImage,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

// Read JSON without accepting excessively large requests.
async function readJsonBody(request) {
  const reader = request.body?.getReader();

  if (!reader) {
    throw Object.assign(
      new Error("Profile information is required."),
      { status: 400 }
    );
  }

  const chunks = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      size += value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});

        throw Object.assign(
          new Error("Profile information is too large."),
          { status: 413 }
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(
      Buffer.concat(chunks).toString("utf8")
    );
  } catch {
    throw Object.assign(
      new Error("Invalid profile information."),
      { status: 400 }
    );
  }
}

// Forward authenticated requests to Express.
async function forwardRequest(token, method, body) {
  const response = await fetch(
    `${API_URL}/api/profile/student`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    }
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const status = response.status;

    if ([400, 401, 403, 413, 429].includes(status)) {
      return fail(
        typeof result?.error === "string"
          ? result.error
          : typeof result?.message === "string"
            ? result.message
            : "Unable to complete the profile request.",
        status
      );
    }

    return fail(
      "Student profile service unavailable.",
      502
    );
  }

  if (result?.success !== true) {
    return fail(
      "Unable to confirm the profile response.",
      502
    );
  }

  let profile;

  try {
    profile = normalizeProfile(result.profile);
  } catch {
    return fail("Invalid profile response.", 502);
  }

  return NextResponse.json(
    {
      success: true,
      profile,
      ...(method === "PUT"
        ? {
            message:
              "Student profile updated successfully.",
          }
        : {}),
    },
    {
      headers: RESPONSE_HEADERS,
    }
  );
}

// Retrieve the student's own learning profile.
export async function GET() {
  try {
    const token = await getToken();

    if (!token) {
      return fail("Sign in to view your profile.", 401);
    }

    return await forwardRequest(token, "GET");
  } catch {
    console.error("Student profile retrieval failed.");

    return fail(
      "Unable to retrieve student profile.",
      502
    );
  }
}

// Create or update the student's own learning profile.
export async function PUT(request) {
  try {
    if (!isSameOrigin(request)) {
      return fail("Access denied.", 403);
    }

    const token = await getToken();

    if (!token) {
      return fail("Sign in to update your profile.", 401);
    }

    const contentType = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (contentType !== "application/json") {
      return fail(
        "JSON profile information is required.",
        415
      );
    }

    const body = await readJsonBody(request);

    const fields = [
      "displayName",
      "biography",
      "learningInterests",
      "education",
      "learningGoals",
    ];

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== fields.length ||
      fields.some(
        (field) => typeof body[field] !== "string"
      ) ||
      Object.keys(body).some(
        (field) => !fields.includes(field)
      )
    ) {
      return fail(
        "Submit only the permitted student profile fields.",
        400
      );
    }

    return await forwardRequest(token, "PUT", body);

  } catch (error) {
    if ([400, 413].includes(error.status)) {
      return fail(error.message, error.status);
    }

    console.error("Student profile update failed.");

    return fail(
      "Unable to update student profile.",
      502
    );
  }
}
