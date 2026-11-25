import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private"
    }
  });
}

export async function POST(request) {
  try {
    // Restrict ticket requests to the approved frontend.
    const expectedOrigin = new URL(
      process.env.APP_ORIGIN || request.url
    ).origin;

    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");

    if (
      origin !== expectedOrigin ||
      (fetchSite && fetchSite !== "same-origin")
    ) {
      return respond({
        success: false,
        message: "Request origin is not allowed."
      }, 403);
    }

    // Keep the main authentication token server-side.
    const cookieStore = await cookies();

    const token = cookieStore.get(
      "tulinkup_token"
    )?.value;

    if (!token) {
      return respond({
        success: false,
        message: "Authentication required."
      }, 401);
    }

    const apiUrl = (
      process.env.API_URL ||
      "http://localhost:5001"
    ).replace(/\/+$/, "");

    const response = await fetch(
      `${apiUrl}/api/realtime/ticket`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000)
      }
    );

    if (response.status >= 500) {
      return respond({
        success: false,
        message: "Real-time messaging is temporarily unavailable."
      }, 502);
    }

    const data = await response.json();

    return respond(data, response.status);
  } catch {
    return respond({
      success: false,
      message: "Unable to establish real-time messaging."
    }, 502);
  }
}
