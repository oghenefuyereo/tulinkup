import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

const ENDPOINT =
  `${API_URL}/api/media/student-profile-image`;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 65536;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function fail(message, status) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: PRIVATE_HEADERS,
    }
  );
}

function requestError(message, status) {
  return Object.assign(
    new Error(message),
    { status }
  );
}

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

async function getToken() {
  const cookieStore = await cookies();

  return cookieStore.get("tulinkup_token")?.value;
}

// Prevent oversized request and response bodies.
async function readLimitedBody(
  message,
  maximumBytes,
  errorStatus
) {
  const length = message.headers.get(
    "content-length"
  );

  if (
    length !== null &&
    Number(length) > maximumBytes
  ) {
    await message.body?.cancel().catch(() => {});

    throw requestError(
      "Image data exceeds the permitted size.",
      errorStatus
    );
  }

  const reader = message.body?.getReader();

  if (!reader) {
    throw requestError(
      "Image data is required.",
      errorStatus === 413 ? 400 : errorStatus
    );
  }

  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      total += value.byteLength;

      if (total > maximumBytes) {
        await reader.cancel().catch(() => {});

        throw requestError(
          "Image data exceeds the permitted size.",
          errorStatus
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

async function parseUpload(request) {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    !/^multipart\/form-data(?:;|$)/i.test(contentType)
  ) {
    throw requestError(
      "A multipart image upload is required.",
      415
    );
  }

  const buffer = await readLimitedBody(
    request,
    MAX_REQUEST_BYTES,
    413
  );

  let form;

  try {
    form = await new Response(buffer, {
      headers: {
        "Content-Type": contentType,
      },
    }).formData();
  } catch {
    throw requestError(
      "Invalid image upload.",
      400
    );
  }

  const entries = Array.from(form.entries());

  if (
    entries.length !== 1 ||
    entries[0][0] !== "image" ||
    typeof entries[0][1] === "string"
  ) {
    throw requestError(
      "Please submit exactly one profile picture.",
      400
    );
  }

  const image = entries[0][1];

  if (image.size === 0) {
    throw requestError(
      "The selected image is empty.",
      400
    );
  }

  if (image.size > MAX_IMAGE_BYTES) {
    throw requestError(
      "Profile images must not exceed 4 MiB.",
      413
    );
  }

  if (!ALLOWED_TYPES.has(image.type)) {
    throw requestError(
      "Only JPEG, PNG, and WebP images are supported.",
      415
    );
  }

  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const forwarded = new FormData();

  forwarded.append(
    "image",
    image,
    `profile.${extensions[image.type]}`
  );

  return forwarded;
}

async function backendRequest(
  token,
  method,
  body
) {
  return fetch(ENDPOINT, {
    method,

    headers: {
      Authorization: `Bearer ${token}`,
    },

    ...(body !== undefined ? { body } : {}),

    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
  });
}

async function handleBackendError(response) {
  const messages = {
    400: "Invalid profile picture.",
    401: "Sign in to manage your profile picture.",
    403: "Student access required.",
    404: "No profile picture found.",
    409: "Your profile changed. Please try again.",
    413: "Profile images must not exceed 4 MiB.",
    415: "Unsupported or incorrect image format.",
    429: "Too many requests. Please try again later.",
  };

  await response.body?.cancel().catch(() => {});

  if (Object.hasOwn(messages, response.status)) {
    return fail(
      messages[response.status],
      response.status
    );
  }

  return fail(
    "Profile picture service unavailable.",
    502
  );
}

// Retrieve the authenticated student's own picture.
export async function GET() {
  try {
    const token = await getToken();

    if (!token) {
      return fail(
        "Sign in to view your profile picture.",
        401
      );
    }

    const response = await backendRequest(
      token,
      "GET"
    );

    if (!response.ok) {
      return handleBackendError(response);
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (
      contentType.split(";")[0].trim().toLowerCase() !==
      "image/webp"
    ) {
      await response.body?.cancel().catch(() => {});

      return fail(
        "Invalid image response.",
        502
      );
    }

    const buffer = await readLimitedBody(
      response,
      MAX_IMAGE_BYTES,
      502
    );

    if (
      buffer.length < 12 ||
      buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WEBP"
    ) {
      return fail(
        "Invalid image response.",
        502
      );
    }

    return new Response(buffer, {
      status: 200,

      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "image/webp",
        "Content-Length": String(buffer.length),
      },
    });

  } catch {
    console.error(
      "Student image retrieval proxy failed."
    );

    return fail(
      "Unable to retrieve profile picture.",
      502
    );
  }
}

async function updateImage(request, method) {
  try {
    if (!isSameOrigin(request)) {
      return fail("Access denied.", 403);
    }

    const token = await getToken();

    if (!token) {
      return fail(
        "Sign in to manage your profile picture.",
        401
      );
    }

    let body;

    if (method === "POST") {
      body = await parseUpload(request);
    } else {
      // DELETE requests must not contain payload data.
      // Next.js may provide an empty, non-null body stream.
      const length = request.headers.get("content-length");

      if (length !== null && !/^0+$/.test(length)) {
        request.body?.cancel().catch(() => {});

        return fail(
          "Image removal does not accept a request body.",
          400
        );
      }

      if (request.body !== null) {
        const reader = request.body.getReader();
        let timer;
        let timedOut = false;

        try {
          // Bound the time spent checking an empty stream.
          const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              reject(new Error("Request body timeout."));
            }, 5000);
          });

          while (true) {
            const { done, value } = await Promise.race([
              reader.read(),
              timeout,
            ]);

            if (done) break;

            // Reject any actual payload immediately.
            if (value && value.byteLength > 0) {
              return fail(
                "Image removal does not accept a request body.",
                400
              );
            }
          }
        } catch {
          return fail(
            timedOut
              ? "Request body timed out."
              : "Unable to validate request body.",
            timedOut ? 408 : 400
          );
        } finally {
          clearTimeout(timer);
          reader.cancel().catch(() => {});
          reader.releaseLock();
        }
      }
    }

    const response = await backendRequest(
      token,
      method,
      body
    );

    if (!response.ok) {
      return handleBackendError(response);
    }

    const buffer = await readLimitedBody(
      response,
      16384,
      502
    );

    const result = JSON.parse(
      buffer.toString("utf8")
    );

    const expectedImageStatus =
      method === "POST";

    if (
      result?.success !== true ||
      result.hasProfileImage !== expectedImageStatus ||
      typeof result.cleanupPending !== "boolean"
    ) {
      return fail(
        "Unable to confirm profile picture update.",
        502
      );
    }

    return NextResponse.json(
      {
        success: true,
        hasProfileImage: result.hasProfileImage,
        cleanupPending: result.cleanupPending,

        message:
          method === "POST"
            ? "Profile picture uploaded successfully."
            : "Profile picture removed successfully.",
      },
      {
        headers: PRIVATE_HEADERS,
      }
    );

  } catch (error) {
    if ([400, 413, 415].includes(error.status)) {
      return fail(
        error.message,
        error.status
      );
    }

    console.error(
      "Student image modification proxy failed."
    );

    return fail(
      "Unable to confirm profile picture update.",
      502
    );
  }
}

export async function POST(request) {
  return updateImage(request, "POST");
}

export async function DELETE(request) {
  return updateImage(request, "DELETE");
}
