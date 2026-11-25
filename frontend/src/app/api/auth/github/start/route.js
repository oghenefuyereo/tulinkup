
import { NextResponse } from "next/server";
import { termsOfService } from "@/content/termsOfService";
import { privacyPolicy } from "@/content/privacyPolicy";
import {
  signOAuthSession,
  oauthInternalHeaders
} from "@/lib/oauthSecurity";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

export async function POST(request) {
  try {
    const origin = request.headers.get("origin");
    const expectedOrigin =
      process.env.APP_ORIGIN || "http://localhost:3000";

    if (origin !== expectedOrigin) {
      return NextResponse.json(
        { message: "Invalid request origin." },
        { status: 403 }
      );
    }

    const {
      mode,
      role,
      termsAccepted,
      termsVersion,
      privacyVersion
    } = await request.json();

    if (!["login", "register"].includes(mode)) {
      return NextResponse.json(
        { message: "Invalid authentication mode." },
        { status: 400 }
      );
    }

    if (
      mode === "register" &&
      (!["student", "tutor"].includes(role) ||
        termsAccepted !== true)
    ) {
      return NextResponse.json(
        { message: "Select a role and accept the terms." },
        { status: 400 }
      );
    }

    if (
      mode === "register" &&
      (
        termsVersion !== termsOfService.version ||
        privacyVersion !== privacyPolicy.version
      )
    ) {
      return NextResponse.json(
        {
          message:
            "The legal documents have changed. Refresh the page and review them again."
        },
        { status: 400 }
      );
    }

    const backend = await fetch(
      API_URL + "/api/auth/github/start",
      {
        method: "POST",
        headers: oauthInternalHeaders(),
        cache: "no-store"
      }
    );

    const data = await backend.json();

    if (
      !backend.ok ||
      !data.success ||
      !data.authorizationUrl ||
      !data.state ||
      !data.codeVerifier
    ) {
      throw new Error("GitHub initialization failed.");
    }

    const authorizationUrl =
      new URL(data.authorizationUrl);

    if (
      authorizationUrl.origin !==
      "https://github.com"
    ) {
      throw new Error("Invalid authorization destination.");
    }

    const response = NextResponse.json(
      { authorizationUrl: authorizationUrl.toString() },
      { headers: { "Cache-Control": "no-store" } }
    );

    response.cookies.set(
      "tulinkup_github_oauth",
      signOAuthSession({
        state: data.state,
        codeVerifier: data.codeVerifier,
        mode,
        role: mode === "register" ? role : null,
        termsAccepted:
          mode === "register" && termsAccepted === true,
        termsVersion:
          mode === "register" ? termsVersion : null,
        privacyVersion:
          mode === "register" ? privacyVersion : null,
        expiresAt: Date.now() + 600000
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth/github/callback",
        maxAge: 600
      }
    );

    return response;

  } catch {
    return NextResponse.json(
      { message: "Unable to start GitHub authentication." },
      { status: 500 }
    );
  }
}
