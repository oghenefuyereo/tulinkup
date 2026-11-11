
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.API_URL || "http://localhost:5001";

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Sign in to update your profile." },
        { status: 401 }
      );
    }

    const form = await request.formData();

    const text = (key, max) =>
      String(form.get(key) ?? "")
        .trim()
        .slice(0, max);

    const fullName = text("fullName", 100);
    const phone = text("phone", 30);

    if (fullName.length < 2) {
      return NextResponse.json(
        { error: "Enter your full name." },
        { status: 400 }
      );
    }

    const userResponse = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in." },
        { status: 401 }
      );
    }

    const { user } = await userResponse.json();

    if (!user || !["student", "tutor"].includes(user.role)) {
      return NextResponse.json(
        { error: "Invalid account." },
        { status: 403 }
      );
    }

    const profileData = {
      fullName,
      phone,
    };

    if (user.role === "tutor") {
      const title = text("title", 120);
      const location = text("location", 120);
      const biography = text("biography", 1500);
      const qualifications = text("qualifications", 1000);
      const experience = text("experience", 1000);

      const hourlyRateRaw = form.get("hourlyRate");
      const hourlyRate = Number(hourlyRateRaw);

      let subjects = [];

      try {
        const parsed = JSON.parse(
          String(form.get("subjects") ?? "[]")
        );

        if (Array.isArray(parsed)) {
          subjects = parsed.filter(
            (subject) =>
              typeof subject === "string" &&
              subject.trim().length > 0
          );
        }
      } catch {
        subjects = [];
      }

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

      const image = form.get("profileImage");

      if (image instanceof File && image.size > 0) {
        return NextResponse.json(
          {
            error:
              "Profile image uploads are not configured yet. Save your profile without an image.",
          },
          { status: 400 }
        );
      }

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

    const response = await fetch(`${API_URL}/api/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(profileData),
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: result.error || "Unable to update profile.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500 }
    );
  }
}
