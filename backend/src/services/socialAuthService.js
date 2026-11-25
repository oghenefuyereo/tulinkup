
"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const {
  validateLegalAcceptance,
  recordLegalAcceptance
} = require("./legalAcceptanceService");

function authError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Validate the identity supplied by a trusted OAuth service.
function validateIdentity(identity) {
  if (
    !identity ||
    !["google", "github"].includes(identity.provider) ||
    typeof identity.providerUserId !== "string" ||
    !identity.providerUserId.trim() ||
    identity.providerUserId.length > 255 ||
    typeof identity.email !== "string" ||
    identity.email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email) ||
    typeof identity.fullName !== "string" ||
    !identity.fullName.trim()
  ) {
    throw authError("Invalid social identity.");
  }

  return {
    provider: identity.provider,
    providerUserId: identity.providerUserId.trim(),
    email: identity.email.trim().toLowerCase(),
    fullName: identity.fullName.trim().slice(0, 150)
  };
}

// Create or authenticate a social account.
async function authenticateSocialUser(
  identity,
  {
    mode = "login",
    role,
    termsAccepted = false,
    termsVersion,
    privacyVersion
  } = {}
) {
  const profile = validateIdentity(identity);

  if (!["login", "register"].includes(mode)) {
    throw authError("Invalid authentication mode.");
  }

  if (
    mode === "register" &&
    (!["student", "tutor"].includes(role) ||
      termsAccepted !== true)
  ) {
    throw authError("Valid role and accepted terms are required.");
  }

  if (mode === "register") {
    validateLegalAcceptance({
      termsAccepted,
      termsVersion,
      privacyVersion
    });
  }

  if (!process.env.JWT_SECRET) {
    throw authError("Authentication is not configured.", 500);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT u.id, u.full_name, u.email,
              u.role, u.account_status
       FROM public.oauth_accounts o
       JOIN public.users u ON u.id = o.user_id
       WHERE o.provider = $1
         AND o.provider_user_id = $2
       FOR UPDATE OF u`,
      [profile.provider, profile.providerUserId]
    );

    let user = existing.rows[0];
    let created = false;

    if (!user) {
      const emailMatch = await client.query(
        `SELECT id FROM public.users
         WHERE LOWER(TRIM(email)) = $1`,
        [profile.email]
      );

      if (emailMatch.rows.length > 0) {
        throw authError(
          "An account already exists. Sign in using your original method.",
          409
        );
      }

      if (mode !== "register") {
        throw authError(
          "No linked account found. Please register first.",
          404
        );
      }

      // Social accounts receive an unknown random password.
      const passwordHash = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        12
      );

      const result = await client.query(
        `INSERT INTO public.users
          (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, email,
                   role, account_status`,
        [
          profile.fullName,
          profile.email,
          passwordHash,
          role
        ]
      );

      user = result.rows[0];

      await client.query(
        `INSERT INTO public.oauth_accounts
          (user_id, provider, provider_user_id, provider_email)
         VALUES ($1, $2, $3, $4)`,
        [
          user.id,
          profile.provider,
          profile.providerUserId,
          profile.email
        ]
      );

      await recordLegalAcceptance(client, {
        userId: user.id,
        registrationMethod: profile.provider,
        termsAccepted,
        termsVersion,
        privacyVersion
      });

      created = true;
    }

    if (user.account_status !== "active") {
      throw authError("This account is not active.", 403);
    }

    if (!["student", "tutor"].includes(user.role)) {
      throw authError(
        "Social authentication is unavailable for this role.",
        403
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h"
      }
    );

    await client.query("COMMIT");

    return {
      created,
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    };

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    if (error.code === "23505") {
      throw authError(
        "An account already exists. Please sign in again.",
        409
      );
    }

    throw error;

  } finally {
    client.release();
  }
}

module.exports = {
  validateIdentity,
  authenticateSocialUser
};
