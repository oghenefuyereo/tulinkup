// Import the database connection.
const pool = require("../config/db");

// Import the Stripe Connect service.
const {
  createTutorOnboardingLink,
  getTutorStripeAccountStatus,
} = require("../services/stripeConnectService");

// Create a consistent error response.
function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

// Verify the authenticated tutor before accessing payment services.
async function authorizeTutor(req, res) {
  // Prevent payment information from being cached.
  res.set("Cache-Control", "no-store");

  const userId = req.user?.userId;

  // Require an authenticated user.
  if (!userId) {
    fail(
      res,
      401,
      "Please log in to access payment settings."
    );

    return null;
  }

  // Validate the authenticated user's ID.
  if (!/^[1-9]\d*$/.test(String(userId))) {
    fail(res, 401, "Invalid user account.");

    return null;
  }

  // Restrict payment account access to tutors.
  if (req.user.role !== "tutor") {
    fail(
      res,
      403,
      "Only tutors can access payment settings."
    );

    return null;
  }

  // Verify the user's current role in the database.
  const result = await pool.query(
    `
    SELECT id, role
    FROM public.users
    WHERE id = $1
      AND role = 'tutor'
    LIMIT 1
    `,
    [userId]
  );

  if (!result.rows.length) {
    fail(
      res,
      403,
      "A valid tutor account is required."
    );

    return null;
  }

  // Use the authenticated database user ID.
  return String(result.rows[0].id);
}

// Handle Stripe Connect errors without exposing sensitive information.
function handleStripeError(res, error, message) {
  // Log limited diagnostic information on the backend.
  console.error("Stripe Connect error:", {
    type: error.type || error.name,
    code: error.code || null,
    requestId: error.requestId || null,
  });

  // Handle temporary Stripe service failures.
  if (
    [
      "StripeConnectionError",
      "StripeAPIError",
      "StripeRateLimitError",
    ].includes(error.type)
  ) {
    return fail(
      res,
      503,
      "The payment service is temporarily unavailable. Please try again."
    );
  }

  return fail(res, 500, message);
}

// Generate a secure onboarding link for the authenticated tutor.
async function generateOnboardingLink(tutorId, res) {
  const onboarding =
    await createTutorOnboardingLink(tutorId);

  // Verify that the service returned valid onboarding information.
  if (
    typeof onboarding?.url !== "string" ||
    !Number.isSafeInteger(onboarding.expiresAt)
  ) {
    throw new Error(
      "Invalid Stripe onboarding response."
    );
  }

  const url = new URL(onboarding.url);

  // Only allow secure Stripe-hosted onboarding URLs.
  if (
    url.protocol !== "https:" ||
    url.hostname !== "connect.stripe.com" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error(
      "Invalid Stripe onboarding URL."
    );
  }

  // Reject expired onboarding links.
  if (
    onboarding.expiresAt <=
    Math.floor(Date.now() / 1000)
  ) {
    throw new Error(
      "The onboarding link has expired."
    );
  }

  // Return only the information required by the frontend.
  return res.status(200).json({
    success: true,
    message:
      "Stripe onboarding link generated successfully.",
    url: onboarding.url,
    expiresAt: onboarding.expiresAt,
    livemode: false,
  });
}

// Start the tutor's Stripe Connect onboarding.
async function startOnboarding(req, res) {
  try {
    const tutorId = await authorizeTutor(req, res);

    if (!tutorId) {
      return;
    }

    // Create or reuse the tutor's Stripe connected account.
    return await generateOnboardingLink(
      tutorId,
      res
    );
  } catch (error) {
    return handleStripeError(
      res,
      error,
      "Unable to start payment account setup."
    );
  }
}

// Generate a replacement for an expired or previously used onboarding link.
async function refreshOnboarding(req, res) {
  try {
    const tutorId = await authorizeTutor(req, res);

    if (!tutorId) {
      return;
    }

    // Generate a fresh link using the tutor's connected account.
    return await generateOnboardingLink(
      tutorId,
      res
    );
  } catch (error) {
    return handleStripeError(
      res,
      error,
      "Unable to refresh payment account setup."
    );
  }
}

// Retrieve the tutor's latest Stripe account status.
async function getAccountStatus(req, res) {
  try {
    const tutorId = await authorizeTutor(req, res);

    if (!tutorId) {
      return;
    }

    // Retrieve and synchronize the latest Stripe account information.
    const status =
      await getTutorStripeAccountStatus(tutorId);

    // Return the information required by the tutor dashboard.
    return res.status(200).json({
      success: true,

      account: {
        hasAccount: status.hasAccount,

        detailsSubmitted: status.detailsSubmitted,

        chargesEnabled: status.chargesEnabled,

        payoutsEnabled: status.payoutsEnabled,

        transfersEnabled: status.transfersEnabled,

        onboardingCompleted:
          status.onboardingCompleted,

        currentlyDue: status.currentlyDue,

        pastDue: status.pastDue,

        pendingVerification:
          status.pendingVerification,

        disabledReason: status.disabledReason,

        platformPaidTutoringEnabled:
          status.platformPaidTutoringEnabled,

        platformTransfersEnabled:
          status.platformTransfersEnabled,

        eligibleForTransfers:
          status.eligibleForTransfers,

        eligibleForPayouts:
          status.eligibleForPayouts,

        livemode: status.livemode,
      },
    });
  } catch (error) {
    return handleStripeError(
      res,
      error,
      "Unable to retrieve payment account status."
    );
  }
}

// Export the Stripe Connect controller functions.
module.exports = {
  startOnboarding,
  refreshOnboarding,
  getAccountStatus,
};