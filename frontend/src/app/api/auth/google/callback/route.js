
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import {
  verifyOAuthSession,
  oauthInternalHeaders
} from "@/lib/oauthSecurity";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

const APP_ORIGIN =
  process.env.APP_ORIGIN || "http://localhost:3000";

function statesMatch(received, expected) {
  if (
    typeof received !== "string" ||
    typeof expected !== "string"
  ) {
    return false;
  }

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return a.length === b.length &&
    timingSafeEqual(a, b);
}

function finish(destination, token) {
  const response = NextResponse.redirect(
    new URL(destination, APP_ORIGIN)
  );

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  response.cookies.set(
    "tulinkup_google_oauth",
    "",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/google/callback",
      maxAge: 0
    }
  );

  if (token) {
    response.cookies.set(
      "tulinkup_token",
      token,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600
      }
    );
  }

  return response;
}

export async function GET(request) {
  let failurePage = "/login";

  try {
    const cookieStore = await cookies();

    const raw = cookieStore.get(
      "tulinkup_google_oauth"
    )?.value;

    if (!raw) {
      return finish("/login?oauth_error=expired");
    }

    const challenge = verifyOAuthSession(raw);

    if (challenge.mode === "register") {
      failurePage = "/register";
    }

    const params = request.nextUrl.searchParams;
    const code = params.get("code");
    const state = params.get("state");

    if (
      !Number.isFinite(challenge.expiresAt) ||
      Date.now() > challenge.expiresAt ||
      !statesMatch(state, challenge.state)
    ) {
      return finish(
        failurePage + "?oauth_error=invalid_state"
      );
    }

    if (params.has("error") || !code) {
      return finish(
        failurePage + "?oauth_error=cancelled"
      );
    }

    const backend = await fetch(
      API_URL + "/api/auth/google/complete",
      {
        method: "POST",
        headers: oauthInternalHeaders(),
        cache: "no-store",
        body: JSON.stringify({
          code,
          codeVerifier: challenge.codeVerifier,
          mode: challenge.mode,
          role: challenge.role,
          termsAccepted: challenge.termsAccepted
        })
      }
    );

    const data = await backend.json();

    if (!backend.ok || !data.success) {
      const errors = {
        403: "account_inactive",
        404: "account_not_found",
        409: "account_exists"
      };

      const reason =
        errors[backend.status] || "authentication_failed";

      return finish(
        failurePage + "?oauth_error=" + reason
      );
    }

    if (
      typeof data.token !== "string" ||
      !data.token ||
      !["student", "tutor"].includes(data.user?.role)
    ) {
      throw new Error("Invalid authentication response.");
    }

    const destination =
      data.user.role === "tutor"
        ? "/dashboard/tutor"
        : "/dashboard/student";

    return finish(destination, data.token);

  } catch {
    return finish(
      failurePage + "?oauth_error=authentication_failed"
    );
  }
}
