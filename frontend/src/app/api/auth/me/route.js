
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("tulinkup_token")?.value;

    if (!token) {
      return NextResponse.json({ user: null });
    }

    const response = await fetch(
      `${process.env.API_URL || "http://localhost:5001"}/api/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { user: null },
        { status: response.status === 401 ? 401 : 502 }
      );
    }

    const data = await response.json();
    const user = data.user;

    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("TuLinkUp authentication error:", error);

    return NextResponse.json(
      { error: "Unable to verify authentication." },
      { status: 500 }
    );
  }
}
