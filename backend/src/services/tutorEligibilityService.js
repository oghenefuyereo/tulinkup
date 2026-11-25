"use strict";

const pool = require("../config/db");

// Create an error that controllers can handle.
function eligibilityError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Make sure the tutor ID is a valid database ID.
function validateTutorId(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw eligibilityError("Invalid tutor ID.", 400);
  }

  if (
    typeof value === "number" &&
    (!Number.isSafeInteger(value) || value <= 0)
  ) {
    throw eligibilityError("Invalid tutor ID.", 400);
  }

  const id = String(value);

  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw eligibilityError("Invalid tutor ID.", 400);
  }

  return id;
}

// Check whether a tutor can offer new tutoring services.
async function requireEligibleTutor(tutorId, db = pool) {
  const id = validateTutorId(tutorId);

  const result = await db.query(
    `SELECT
       u.id AS user_id,
       tp.id AS profile_id
     FROM public.users u
     JOIN public.tutor_profiles tp
       ON tp.user_id = u.id
     WHERE u.id = $1::bigint
       AND u.role = 'tutor'
       AND u.account_status = 'active'
       AND tp.approval_status = 'approved'`,
    [id]
  );

  if (result.rows.length !== 1) {
    throw eligibilityError(
      "This tutor is not currently eligible to offer tutoring services."
    );
  }

  return {
    userId: String(result.rows[0].user_id),
    profileId: String(result.rows[0].profile_id)
  };
}

// Lock the tutor account and profile during a tutoring transaction.
async function lockEligibleTutor(tutorId, client) {
  const id = validateTutorId(tutorId);

  if (
    !client ||
    client === pool ||
    typeof client.query !== "function" ||
    typeof client.release !== "function"
  ) {
    throw eligibilityError(
      "A database transaction client is required.",
      500
    );
  }

  // Lock the account before the profile to match the approval service.
  const account = await client.query(
    `SELECT id
     FROM public.users
     WHERE id = $1::bigint
       AND role = 'tutor'
       AND account_status = 'active'
     FOR SHARE`,
    [id]
  );

  if (account.rows.length !== 1) {
    throw eligibilityError(
      "This tutor is not currently eligible to offer tutoring services."
    );
  }

  const profile = await client.query(
    `SELECT id, user_id
     FROM public.tutor_profiles
     WHERE user_id = $1::bigint
       AND approval_status = 'approved'
     FOR SHARE`,
    [id]
  );

  if (profile.rows.length !== 1) {
    throw eligibilityError(
      "This tutor is not currently eligible to offer tutoring services."
    );
  }

  return {
    userId: id,
    profileId: String(profile.rows[0].id)
  };
}

module.exports = {
  validateTutorId,
  requireEligibleTutor,
  lockEligibleTutor
};
