
// Import NextResponse to send responses from the Next.js API.
import { NextResponse } from "next/server";

// Import cookies to access the user's authentication token.
import { cookies } from "next/headers";

// Set the Express backend URL for profile requests.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Handle requests to update a student's or tutor's profile.
export async function POST(request) {
  try {
    // Read the user's authentication token from the stored cookie.
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    // Require the user to sign in before updating their profile.
    if (!token) {
      return NextResponse.json(
        { error: "Sign in to update your profile." },
        { status: 401 }
      );
    }

    // Read the profile information submitted through the form.
    const form = await request.formData();

    // Create a helper function to clean and limit text inputs.
    const text = (key, max) =>
      String(form.get(key) ?? "")
        .trim()
        .slice(0, max);

    // Get the user's full name and phone number.
    const fullName = text("fullName", 100);
    const phone = text("phone", 30);

    // Make sure the user's full name contains at least two characters.
    if (fullName.length < 2) {
      return NextResponse.json(
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
    });

    // Ask the user to sign in again if authentication fails.
    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in." },
        { status: 401 }
      );
    }

    // Get the authenticated user's account information.
    const { user } = await userResponse.json();

    // Allow only valid student and tutor accounts to update profiles.
    if (!user || !["student", "tutor"].includes(user.role)) {
      return NextResponse.json(
        { error: "Invalid account." },
        { status: 403 }
      );
    }

    // Prepare the basic profile information for the backend.
    const profileData = {
      fullName,
      phone,
    };

    // Collect additional profile information for tutor accounts.
    if (user.role === "tutor") {
      // Get the tutor's professional title and location.
      const title = text("title", 120);
      const location = text("location", 120);

      // Get the tutor's biography, qualifications, and experience.
      const biography = text("biography", 1500);
      const qualifications = text("qualifications", 1000);
      const experience = text("experience", 1000);

      // Convert the tutor's hourly rate into a number.
      const hourlyRateRaw = form.get("hourlyRate");
      const hourlyRate = Number(hourlyRateRaw);

      // Create an empty list to store the tutor's selected subjects.
      let subjects = [];

      try {
        // Read the subjects submitted by the frontend.
        const parsed = JSON.parse(
          String(form.get("subjects") ?? "[]")
        );

        // Keep only subjects that contain valid text.
        if (Array.isArray(parsed)) {
          subjects = parsed.filter(
            (subject) =>
              typeof subject === "string" &&
              subject.trim().length > 0
          );
        }
      } catch {
        // Use an empty list if the subjects cannot be read.
        subjects = [];
      }

      // Make sure the tutor has completed all required profile fields.
      // The hourly rate must also be between 10 and 500.
      if (
        !title ||
        !location ||
        biography.length < 20 ||
        !qualifications ||
        !experience ||
        subjects.length < 1 ||
        hourlyRateRaw === null ||
        String(hourlyRateRaw).trim() === "" ||
        !Number.isFinite(hourlyRate) ||
        hourlyRate < 10 ||
        hourlyRate > 500
      ) {
        return NextResponse.json(
          {
            error:
              "Complete all tutor fields and choose at least one subject.",
          },
          { status: 400 }
        );
      }

      // Check whether the tutor selected a profile image.
      const image = form.get("profileImage");

      // Prevent image uploads until this feature is configured.
      if (image instanceof File && image.size > 0) {
        return NextResponse.json(
          {
            error:
              "Profile image uploads are not configured yet. Save your profile without an image.",
          },
          { status: 400 }
        );
      }

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
    });

    // Read the backend response or use an empty object if parsing fails.
    const result = await response.json().catch(() => ({}));

    // Return an error if the backend cannot update the profile.
    if (!response.ok) {
      return NextResponse.json(
        {
          error: result.error || "Unable to update profile.",
        },
        { status: response.status }
      );
    }

    // Confirm that the profile was updated successfully.
    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    // Log any unexpected errors during the profile update.
    console.error("Profile update error:", error);

    // Return an error if the profile update cannot be completed.
    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500 }
    );
  }
}
