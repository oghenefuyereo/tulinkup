
"use strict";

const { OAuth2Client } = require("google-auth-library");
const crypto = require("node:crypto");

// Initialize Google OAuth using server-side credentials.
function createGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth is not configured.");
  }

  return new OAuth2Client(
    clientId,
    clientSecret,
    redirectUri
  );
}

// Generate secure OAuth state and PKCE values.
function createOAuthChallenge() {
  const state = crypto.randomBytes(32).toString("base64url");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return {
    state,
    codeVerifier,
    codeChallenge
  };
}

// Generate the Google authorization URL.
function createAuthorizationUrl(challenge) {
  const client = createGoogleClient();

  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state: challenge.state,
    code_challenge: challenge.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account"
  });
}

// Exchange the authorization code and verify the Google identity.
async function verifyGoogleIdentity(code, codeVerifier) {
  if (
    typeof code !== "string" ||
    !code.trim() ||
    typeof codeVerifier !== "string" ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier)
  ) {
    throw new Error("Invalid Google authorization request.");
  }

  const client = createGoogleClient();

  const { tokens } = await client.getToken({
    code,
    codeVerifier
  });

  if (!tokens.id_token) {
    throw new Error("Google identity token is missing.");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const profile = ticket.getPayload();

  if (
    !profile ||
    !profile.sub ||
    !profile.email ||
    profile.email_verified !== true
  ) {
    throw new Error("Google identity could not be verified.");
  }

  return {
    provider: "google",
    providerUserId: profile.sub,
    email: profile.email.trim().toLowerCase(),
    fullName: (profile.name || profile.email).trim().slice(0, 150)
  };
}

module.exports = {
  createGoogleClient,
  createOAuthChallenge,
  createAuthorizationUrl,
  verifyGoogleIdentity
};
