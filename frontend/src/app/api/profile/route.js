// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// Import cookies to access the user's authentication token.
import { cookies } from "next/headers";

// Set the Express backend URL for profile requests.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Define the maximum private tutoring hourly rate.
const MAX_HOURLY_RATE_CENTS = 2500;

// Restrict account profile requests to small text forms.
const MAX_PROFILE_REQUEST_BYTES = 64 * 1024;

const ALLOWED_PROFILE_FIELDS = new Set([
  "scope",
  "fullName",
  "phone",
  "title",
  "location",
  "biography",
  "qualifications",
  "experience",
  "hourlyRate",
  "subjects",
]);

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function profileJson(body, options = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: {
      ...PRIVATE_HEADERS,
      ...options.headers,
    },
  });
}

class ProfileRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Reject cross-origin account modifications.
function isSameOrigin(request) {
  const origin = request.headers.get("origin");

  if (!origin) return false;

  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

// Read and validate a bounded text-only form.
async function readProfileForm(request) {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    !/^(multipart\/form-data|application\/x-www-form-urlencoded)(?:;|$)/i
      .test(contentType)
  ) {
    throw new ProfileRequestError(
      "Unsupported profile request format.",
      415
    );
  }

  const contentLength =
    request.headers.get("content-length");

  if (
    contentLength !== null &&
    Number(contentLength) > MAX_PROFILE_REQUEST_BYTES
  ) {
    await request.body?.cancel().catch(() => {});

    throw new ProfileRequestError(
      "Profile request is too large.",
      413
    );
  }

  const reader = request.body?.getReader();

  if (!reader) {
    throw new ProfileRequestError(
      "Profile information is required.",
      400
    );
  }

  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      total += value.byteLength;

      if (total > MAX_PROFILE_REQUEST_BYTES) {
        await reader.cancel().catch(() => {});

        throw new ProfileRequestError(
          "Profile request is too large.",
          413
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  let form;

  try {
    form = await new Response(
      Buffer.concat(chunks),
      {
        headers: {
          "Content-Type": contentType,
        },
      }
    ).formData();

  } catch {
    throw new ProfileRequestError(
      "Invalid profile form.",
      400
    );
  }

  const seen = new Set();

  for (const [name, value] of form.entries()) {
    if (!ALLOWED_PROFILE_FIELDS.has(name)) {
      throw new ProfileRequestError(
        "Unexpected profile field.",
        400
      );
    }

    if (seen.has(name)) {
      throw new ProfileRequestError(
        "Duplicate profile field.",
        400
      );
    }

    if (typeof value !== "string") {
      throw new ProfileRequestError(
        "File attachments are not accepted.",
        400
      );
    }

    if (value.includes("\u0000")) {
      throw new ProfileRequestError(
        "Invalid profile information.",
        400
      );
    }

    seen.add(name);
  }

  return form;
}



// Validate the tutor's hourly rate and convert it to cents.
function getHourlyRateCents(value) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  const hourlyRate = Number(value);

  if (
    !Number.isFinite(hourlyRate) ||
    hourlyRate < 0 ||
    hourlyRate > MAX_HOURLY_RATE_CENTS / 100
  ) {
    return null;
  }

  const cents = Math.round(hourlyRate * 100);

  if (
    Math.abs(hourlyRate * 100 - cents) > 0.000001
  ) {
    return null;
  }

  return cents;
}

// Handle requests to update a student's or tutor's profile.
export async function POST(request) {
  try {
    if (!isSameOrigin(request)) {
      return profileJson(
        { error: "Access denied." },
        { status: 403 }
      );
    }

    // Read the user's authentication token from the stored cookie.
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    // Require the user to sign in before updating their profile.
    if (!token) {
      return profileJson(
        { error: "Sign in to update your profile." },
        { status: 401 }
      );
    }

    // Read the profile information submitted through the form.
    const form = await readProfileForm(request);

    // Create a helper function to clean and limit text inputs.
    const text = (key, max) =>
      String(form.get(key) ?? "")
        .trim()
        .slice(0, max);

    // Get the user's full name and phone number.
    const professionalOnly =
      form.get("scope") === "professional";

    const fullName = text("fullName", 100);
    const phone = text("phone", 30);

    // Make sure the user's full name contains at least two characters.
    if (!professionalOnly && fullName.length < 2) {
      return profileJson(
        { error: "Enter your full name." },
        { status: 400 }
      );
    }

    // Verify the user's login through the Express backend.
    const userResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });

    // Ask the user to sign in again if their session has expired.
    if (userResponse.status === 401) {
      return profileJson(
        {
          error:
            "Your session has expired. Please sign in.",
        },
        { status: 401 }
      );
    }

    // Prevent unauthorized accounts from updating profiles.
    if (userResponse.status === 403) {
      return profileJson(
        { error: "Access denied." },
        { status: 403 }
      );
    }

    // Handle errors returned by the authentication service.
    if (!userResponse.ok) {
      return profileJson(
        {
          error:
            "Unable to verify your account. Please try again.",
        },
        { status: 502 }
      );
    }

    // Get the authenticated user's account information.
    const { user } = await userResponse.json();

    // Allow only valid student and tutor accounts to update profiles.
    if (!user || !["student", "tutor"].includes(user.role)) {
      return profileJson(
        { error: "Invalid account." },
        { status: 403 }
      );
    }

    const accountOnly = form.get("scope") === "account";

    if (
      form.has("scope") &&
      !accountOnly &&
      !professionalOnly
    ) {
      return profileJson(
        { error: "Invalid update scope." },
        { status: 400 }
      );
    }

    if (accountOnly) {
      if (user.role !== "tutor") {
        return profileJson(
          { error: "Access denied." },
          { status: 403 }
        );
      }

      const allowed = new Set([
        "scope", "fullName", "phone",
      ]);

      if (
        !form.has("fullName") ||
        !form.has("phone") ||
        [...form.keys()].some((key) => !allowed.has(key))
      ) {
        return profileJson(
          { error: "Invalid account information." },
          { status: 400 }
        );
      }
    }

    if (professionalOnly) {
      if (user.role !== "tutor") {
        return profileJson(
          { error: "Access denied." },
          { status: 403 }
        );
      }

      const allowed = new Set([
        "scope",
        "title",
        "location",
        "biography",
        "qualifications",
        "experience",
        "hourlyRate",
        "subjects",
      ]);

      if (
        [...form.keys()].some(
          (key) => !allowed.has(key)
        ) ||
        [...allowed].some(
          (key) => !form.has(key)
        )
      ) {
        return profileJson(
          { error: "Invalid professional information." },
          { status: 400 }
        );
      }
    }

    // Prepare the basic profile information for the backend.
    const profileData = professionalOnly
      ? { scope: "professional" }
      : {
          fullName,
          phone,
          ...(accountOnly ? { scope: "account" } : {}),
        };

    // Collect additional profile information for tutor accounts.
    if (user.role === "tutor" && !accountOnly) {
      // Get the tutor's professional title and location.
      const title = text("title", 120);
      const location = text("location", 120);

      // Get the tutor's biography, qualifications, and experience.
      const biography = text("biography", 1500);
      const qualifications = text("qualifications", 1000);
      const experience = text("experience", 1000);

      // Retrieve and validate the tutor's hourly rate.
      const hourlyRateRaw = form.get("hourlyRate");

      const hourlyRateCents =
        getHourlyRateCents(hourlyRateRaw);

      // Allow free tutoring and hourly rates up to $25 CAD.
      if (hourlyRateCents === null) {
        return profileJson(
          {
            error:
              "Enter a valid hourly rate between $0 and $25 CAD, with no more than two decimal places.",
          },
          { status: 400 }
        );
      }

      // Convert the validated hourly rate into dollars for the backend.
      const hourlyRate = hourlyRateCents / 100;

      // Create an empty list to store the tutor's selected subjects.
      let subjects = [];

      try {
        // Read the subjects submitted by the frontend.
        const parsed = JSON.parse(
          String(form.get("subjects") ?? "[]")
        );

        // Keep only subjects that contain valid text.
        if (Array.isArray(parsed)) {
          subjects = parsed
            .filter(
              (subject) =>
                typeof subject === "string" &&
                subject.trim().length > 0
            )
            .map((subject) => subject.trim());

          // Remove duplicate subjects.
          subjects = [...new Set(subjects)];
        }
      } catch {
        // Use an empty list if the subjects cannot be read.
        subjects = [];
      }

      // Make sure the tutor has completed all required profile fields.
      if (
        !title ||
        !location ||
        biography.length < 20 ||
        !qualifications ||
        !experience ||
        subjects.length < 1
      ) {
        return profileJson(
          {
            error:
              "Complete all tutor fields and choose at least one subject.",
          },
          { status: 400 }
        );
      }

      // Make sure the selected subjects fit the database field.
      if (subjects.join(", ").length > 150) {
        return profileJson(
          { error: "Choose valid subjects." },
          { status: 400 }
        );
      }

      // Profile images are managed through /api/profile/image.
      // Add the tutor's additional details to the profile information.
      Object.assign(profileData, {
        title,
        location,
        biography,
        qualifications,
        experience,
        hourlyRate,
        subjects,
      });
    }

    // Send the updated profile information to the Express backend.
    const response = await fetch(`${API_URL}/api/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profileData),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });

    // Read the backend response or use an empty object if parsing fails.
    const result = await response.json().catch(() => ({}));

    // Return an error if the backend cannot update the profile.
    if (!response.ok) {
      return profileJson(
        {
          error:
            result.error ||
            result.message ||
            "Unable to update profile.",
        },
        { status: response.status }
      );
    }

    // Verify that the backend successfully updated the profile.
    if (!result.success) {
      return profileJson(
        {
          error: "Unable to confirm the profile update.",
        },
        { status: 502 }
      );
    }

    // Confirm that the profile was updated successfully.
    return profileJson({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    // Log any unexpected errors during the profile update.
    if (error instanceof ProfileRequestError) {
      return profileJson(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Profile update request failed.");

    // Return an error if the profile update cannot be completed.
    return profileJson(
      { error: "Unable to update profile." },
      { status: 500 }
    );
  }
}