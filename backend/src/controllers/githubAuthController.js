"use strict";

const {
  createGitHubAuthChallenge,
  verifyGitHubIdentity
} = require("../services/githubOAuthService");

const {
  authenticateSocialUser
} = require("../services/socialAuthService");

function startGitHubAuth(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    const challenge = createGitHubAuthChallenge();

    return res.json({
      success: true,
      authorizationUrl: challenge.authorizationUrl,
      state: challenge.state,
      codeVerifier: challenge.codeVerifier
    });

  } catch {
    console.error("GitHub OAuth initialization failed.");

    return res.status(500).json({
      success: false,
      message: "Unable to initialize GitHub authentication."
    });
  }
}

async function completeGitHubAuth(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    const {
      code,
      codeVerifier,
      mode,
      role,
      termsAccepted,
      termsVersion,
      privacyVersion
    } = req.body || {};

    if (!["login", "register"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid authentication mode."
      });
    }

    if (
      mode === "register" &&
      (!["student", "tutor"].includes(role) ||
        termsAccepted !== true)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid role and accepted terms are required."
      });
    }

    if (
      typeof code !== "string" ||
      !code.trim() ||
      code.length > 4096 ||
      typeof codeVerifier !== "string" ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid GitHub authorization request."
      });
    }

    let identity;

    try {
      identity = await verifyGitHubIdentity(
        code,
        codeVerifier
      );
    } catch {
      return res.status(401).json({
        success: false,
        message: "GitHub identity verification failed."
      });
    }

    const result = await authenticateSocialUser(
      identity,
      {
        mode,
        role,
        termsAccepted,
        termsVersion,
        privacyVersion
      }
    );

    return res.status(result.created ? 201 : 200).json({
      success: true,
      message: result.created
        ? "Account created successfully."
        : "Login successful.",
      token: result.token,
      user: result.user
    });

  } catch (error) {
    const status = [400, 403, 404, 409].includes(error.status)
      ? error.status
      : 500;

    if (status === 500) {
      console.error("GitHub authentication failed.");
    }

    return res.status(status).json({
      success: false,
      message: status === 500
        ? "Unable to complete GitHub authentication."
        : error.message
    });
  }
}

module.exports = {
  startGitHubAuth,
  completeGitHubAuth
};
