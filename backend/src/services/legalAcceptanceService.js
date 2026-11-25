"use strict";

const {
  TERMS_VERSION,
  PRIVACY_VERSION,
  REGISTRATION_METHODS
} = require("../config/legal");

// Validate explicit legal acceptance and document versions.
function validateLegalAcceptance({
  termsAccepted,
  termsVersion,
  privacyVersion
} = {}) {
  if (termsAccepted !== true) {
    const error = new Error(
      "Accept the Terms of Service and acknowledge the Privacy Policy."
    );

    error.status = 400;
    throw error;
  }

  if (
    termsVersion !== TERMS_VERSION ||
    privacyVersion !== PRIVACY_VERSION
  ) {
    const error = new Error(
      "The legal documents have changed. Refresh the page and review them again."
    );

    error.status = 400;
    throw error;
  }

  return true;
}

// Save acceptance within the account creation transaction.
async function recordLegalAcceptance(
  client,
  {
    userId,
    registrationMethod,
    termsAccepted,
    termsVersion,
    privacyVersion
  }
) {
  validateLegalAcceptance({
    termsAccepted,
    termsVersion,
    privacyVersion
  });

  if (
    userId === undefined ||
    userId === null ||
    userId === ""
  ) {
    throw new Error("A valid user ID is required.");
  }

  if (!REGISTRATION_METHODS.includes(registrationMethod)) {
    throw new Error("Invalid registration method.");
  }

  const result = await client.query(
    `INSERT INTO public.user_legal_acceptances
      (
        user_id,
        terms_version,
        privacy_version,
        registration_method
      )
     VALUES ($1, $2, $3, $4)
     RETURNING
       id,
       user_id,
       terms_version,
       privacy_version,
       terms_accepted_at,
       privacy_acknowledged_at,
       registration_method`,
    [
      userId,
      termsVersion,
      privacyVersion,
      registrationMethod
    ]
  );

  return result.rows[0];
}

module.exports = {
  validateLegalAcceptance,
  recordLegalAcceptance
};
