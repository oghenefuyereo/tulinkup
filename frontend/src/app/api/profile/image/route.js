import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Return a consistent JSON error response.
function fail(message, status) {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

// Reject cross-origin image modification requests.
function isSameOrigin(request) {
  const origin = request.headers.get("origin");

  if (!origin) return false;

  try {
    return new URL(origin).origin ===
      new URL(request.url).origin;
  } catch {
    return false;
  }
}

// Retrieve the authenticated user's token.
async function getToken() {
  const cookieStore = await cookies();

  return cookieStore.get("tulinkup_token")?.value;
}

// Forward image requests to the Express backend.
async function forwardRequest(token, method, body) {
  const response = await fetch(
    `${API_URL}/api/media/profile-image`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body } : {}),
      cache: "no-store",
    }
  );

  const result = await response.json().catch(() => null);

  if (!result) {
    return fail(
      "Unable to confirm the image operation.",
      502
    );
  }

  if (!response.ok) {
    return fail(
      result.error ||
        "Unable to complete the image operation.",
      response.status
    );
  }

  if (!result.success) {
    return fail(
      "Unable to confirm the image operation.",
      502
    );
  }

  return NextResponse.json(result);
}

// Upload or replace the tutor's profile image.
export async function POST(request) {
  try {
    if (!isSameOrigin(request)) {
      return fail("Access denied.", 403);
    }

    const token = await getToken();

    if (!token) {
      return fail(
        "Sign in to upload a profile image.",
        401
      );
    }

    const contentLength = Number(
      request.headers.get("content-length") || 0
    );

    if (contentLength > MAX_IMAGE_BYTES + 65536) {
      return fail(
        "Profile images must not exceed 4 MiB.",
        413
      );
    }

    let form;

    try {
      form = await request.formData();
    } catch {
      return fail("Invalid image upload.", 400);
    }

    const files = form.getAll("image");
    const image = files[0];

    if (
      files.length !== 1 ||
      !(image instanceof File) ||
      image.size === 0
    ) {
      return fail("Please select one image.", 400);
    }

    if (image.size > MAX_IMAGE_BYTES) {
      return fail(
        "Profile images must not exceed 4 MiB.",
        413
      );
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return fail(
        "Only JPEG, PNG, and WebP images are supported.",
        415
      );
    }

    const body = new FormData();

    body.append("image", image, image.name);

    return await forwardRequest(token, "POST", body);
  } catch {
    console.error("Profile image request failed.");

    return fail(
      "Unable to upload profile image.",
      500
    );
  }
}

// Remove the tutor's current profile image.
export async function DELETE(request) {
  try {
    if (!isSameOrigin(request)) {
      return fail("Access denied.", 403);
    }

    const token = await getToken();

    if (!token) {
      return fail(
        "Sign in to remove your profile image.",
        401
      );
    }

    return await forwardRequest(token, "DELETE");
  } catch {
    console.error("Profile image removal failed.");

    return fail(
      "Unable to remove profile image.",
      500
    );
  }
}
