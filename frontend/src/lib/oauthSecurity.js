
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function signature(payload) {
  const secret = process.env.OAUTH_COOKIE_SECRET;

  if (!secret || secret.length < 64) {
    throw new Error("OAuth cookie security is not configured.");
  }

  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export function signOAuthSession(session) {
  const payload = Buffer.from(
    JSON.stringify(session)
  ).toString("base64url");

  return payload + "." + signature(payload);
}

export function verifyOAuthSession(value) {
  if (
    typeof value !== "string" ||
    value.length > 4096
  ) {
    throw new Error("Invalid OAuth session.");
  }

  const parts = value.split(".");

  if (parts.length !== 2) {
    throw new Error("Invalid OAuth session.");
  }

  const [payload, received] = parts;

  const a = Buffer.from(received);
  const b = Buffer.from(signature(payload));

  if (
    a.length !== b.length ||
    !timingSafeEqual(a, b)
  ) {
    throw new Error("Invalid OAuth session signature.");
  }

  const session = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8")
  );

  if (
    !Number.isFinite(session.expiresAt) ||
    Date.now() > session.expiresAt
  ) {
    throw new Error("OAuth session expired.");
  }

  return session;
}

export function oauthInternalHeaders() {
  const secret = process.env.OAUTH_INTERNAL_SECRET;

  if (!secret) {
    throw new Error("Internal OAuth security is not configured.");
  }

  return {
    "Content-Type": "application/json",
    "x-oauth-internal-secret": secret
  };
}
