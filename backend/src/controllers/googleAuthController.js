
"use strict";

const {
  createOAuthChallenge,
  createAuthorizationUrl,
  verifyGoogleIdentity
} = require("../services/googleOAuthService");

const {
  authenticateSocialUser
} = require("../services/socialAuthService");

// Prevent caching of authentication responses.
function disableCache(res) {
  res.set("Cache-Control", "no-store");
}

// Generate Google authorization details.
function startGoogleAuth(req, res) {
  disableCache(res);

  try {
    const challenge = createOAuthChallenge();
    const authorizationUrl = createAuthorizationUrl(challenge);

    return res.json({
      success: true,
      authorizationUrl,
      state: challenge.state,
      codeVerifier: challenge.codeVerifier
    });

  } catch (error) {
    console.error("Google OAuth initialization failed.");

    return res.status(500).json({
      success: false,
      message: "Unable to initialize Google authentication."
    });
  }
}

// Exchange the Google authorization code.
// The frontend server must validate browser-bound OAuth state
// before forwarding the code and verifier to this endpoint.
async function completeGoogleAuth(req, res) {
  disableCache(res);

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
      !/^[A-Za-z0-9_-]{43,128}$/.test(codeVerifier)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google authorization request."
      });
    }

    let identity;

    try {
      identity = await verifyGoogleIdentity(
        code,
        codeVerifier
      );
    } catch {
      return res.status(401).json({
        success: false,
        message: "Google identity verification failed."
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
      console.error("Google authentication failed.");
    }

    return res.status(status).json({
      success: false,
      message: status === 500
        ? "Unable to complete Google authentication."
        : error.message
    });
  }
}

module.exports = {
  startGoogleAuth,
  completeGoogleAuth
};
