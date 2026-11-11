
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

async function handler(request, context) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Please log in as a tutor." },
      { status: 401 }
    );
  }

  const { path = [] } = await context.params;

  const allowed =
    (request.method === "GET" &&
      path.length === 1 &&
      path[0] === "me") ||
    (request.method === "POST" && path.length === 0) ||
    (["PUT", "DELETE"].includes(request.method) &&
      path.length === 1 &&
      /^\d+$/.test(path[0]));

  if (!allowed) {
    return NextResponse.json(
      { error: "Endpoint not found." },
      { status: 404 }
    );
  }

  const endpoint = path.length
    ? `/api/availability/${path.map(encodeURIComponent).join("/")}`
    : "/api/availability";

  try {
    const options = {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    };

    if (["POST", "PUT"].includes(request.method)) {
      options.headers["Content-Type"] = "application/json";
      options.body = await request.text();
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type")
          || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Availability proxy error:", error);

    return NextResponse.json(
      { error: "Unable to connect to the backend." },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
