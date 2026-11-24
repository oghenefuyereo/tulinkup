"use strict";

const crypto = require("node:crypto");

function getConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GitHub OAuth is not configured.");
  }

  return { clientId, clientSecret, redirectUri };
}

function createGitHubAuthChallenge() {
  const config = getConfig();

  const state = crypto.randomBytes(32).toString("base64url");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const url = new URL("https://github.com/login/oauth/authorize");

  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "read:user user:email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  }).toString();

  return {
    authorizationUrl: url.toString(),
    state,
    codeVerifier
  };
}

async function requestGitHub(url, options) {
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error("GitHub authentication request failed.");
  }

  return response.json();
}

async function verifyGitHubIdentity(code, codeVerifier) {
  const config = getConfig();

  if (typeof code !== "string" || !code || code.length > 4096) {
    throw new Error("Invalid GitHub authorization code.");
  }

  if (
    typeof codeVerifier !== "string" ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
  ) {
    throw new Error("Invalid GitHub PKCE verifier.");
  }

  const tokenData = await requestGitHub(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
        code_verifier: codeVerifier
      })
    }
  );

  if (
    tokenData.error ||
    typeof tokenData.access_token !== "string" ||
    !tokenData.access_token
  ) {
    throw new Error("GitHub token exchange failed.");
  }

  const headers = {
    Authorization: "Bearer " + tokenData.access_token,
    Accept: "application/vnd.github+json",
    "User-Agent": "TuLinkUp"
  };

  const [profile, emails] = await Promise.all([
    requestGitHub("https://api.github.com/user", { headers }),
    requestGitHub("https://api.github.com/user/emails", { headers })
  ]);

  if (!Number.isSafeInteger(profile.id) || profile.id <= 0) {
    throw new Error("Invalid GitHub user identity.");
  }

  if (!Array.isArray(emails)) {
    throw new Error("Invalid GitHub email response.");
  }

  const verifiedEmail = emails.find(
    item =>
      item.primary === true &&
      item.verified === true &&
      typeof item.email === "string"
  );

  if (!verifiedEmail) {
    throw new Error("GitHub account requires a verified primary email.");
  }

  const email = verifiedEmail.email.trim().toLowerCase();

  if (!email || email.length > 255) {
    throw new Error("Invalid GitHub email address.");
  }

  const fullName = String(
    profile.name || profile.login || ""
  ).trim().slice(0, 150);

  if (!fullName) {
    throw new Error("GitHub account name is missing.");
  }

  return {
    provider: "github",
    providerUserId: String(profile.id),
    email,
    fullName
  };
}

module.exports = {
  createGitHubAuthChallenge,
  verifyGitHubIdentity
};
