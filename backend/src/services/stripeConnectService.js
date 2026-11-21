// Import the database connection.
const pool = require("../config/db");

// Import the Stripe configuration.
const stripe = require("../config/stripe");

// Import the platform settings service.
const {
  getPlatformSettings,
} = require("./platformSettingsService");

// Configure Stripe Connect for sandbox development.
const LIVEMODE = false;
const ACCOUNT_COUNTRY = "CA";

// Validate the tutor's user ID.
function validateTutorId(tutorId) {
  if (!/^[1-9]\d*$/.test(String(tutorId))) {
    throw new Error("Invalid tutor ID.");
  }

  return String(tutorId);
}

// Validate the Stripe connected account ID.
function validateStripeAccountId(accountId) {
  if (
    typeof accountId !== "string" ||
    !/^acct_[a-zA-Z0-9]+$/.test(accountId)
  ) {
    throw new Error("Invalid Stripe account ID.");
  }

  return accountId;
}

// Retrieve the configured frontend URL.
function getFrontendUrl() {
  const frontendUrl =
    process.env.FRONTEND_URL?.trim() ||
    "http://localhost:3000";

  const url = new URL(frontendUrl);

  // Allow HTTP only for local development.
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(
        url.hostname
      )
    )
  ) {
    throw new Error("Invalid frontend URL.");
  }

  return url.origin;
}

// Retrieve and verify the tutor's user account.
async function getTutor(tutorId, db = pool) {
  const id = validateTutorId(tutorId);

  const result = await db.query(
    `
    SELECT
      id,
      full_name,
      email,
      role
    FROM public.users
    WHERE id = $1
      AND role = 'tutor'
    LIMIT 1
    `,
    [id]
  );

  if (!result.rows.length) {
    throw new Error("Tutor account not found.");
  }

  return result.rows[0];
}

// Retrieve a tutor's stored Stripe connected account.
async function getTutorStripeAccount(
  tutorId,
  db = pool
) {
  const id = validateTutorId(tutorId);

  const result = await db.query(
    `
    SELECT *
    FROM public.tutor_stripe_accounts
    WHERE tutor_id = $1
      AND livemode = $2
    LIMIT 1
    `,
    [id, LIVEMODE]
  );

  return result.rows[0] || null;
}

// Convert Stripe account information into application status fields.
function formatStripeAccountStatus(account) {
  validateStripeAccountId(account?.id);

  // Reject deleted connected accounts.
  if (account.deleted === true) {
    throw new Error(
      "The Stripe connected account has been deleted."
    );
  }

  const detailsSubmitted =
    account.details_submitted === true;

  const chargesEnabled =
    account.charges_enabled === true;

  const payoutsEnabled =
    account.payouts_enabled === true;

  const transfersEnabled =
    account.capabilities?.transfers === "active";

  const currentlyDue =
    account.requirements?.currently_due || [];

  const pastDue =
    account.requirements?.past_due || [];

  const pendingVerification =
    account.requirements?.pending_verification || [];

  const disabledReason =
    account.requirements?.disabled_reason || null;

  // Determine whether the tutor is ready to receive earnings.
  const onboardingCompleted =
    detailsSubmitted &&
    transfersEnabled &&
    payoutsEnabled &&
    currentlyDue.length === 0 &&
    pastDue.length === 0 &&
    pendingVerification.length === 0 &&
    !disabledReason;

  return {
    stripeAccountId: account.id,
    detailsSubmitted,
    chargesEnabled,
    payoutsEnabled,
    transfersEnabled,
    onboardingCompleted,
    currentlyDue,
    pastDue,
    pendingVerification,
    disabledReason,
  };
}

// Retrieve connected account information directly from Stripe.
async function retrieveStripeAccount(accountId) {
  const id = validateStripeAccountId(accountId);

  const account = await stripe.accounts.retrieve(id);

  if (!account || account.deleted === true) {
    throw new Error(
      "Stripe connected account is unavailable."
    );
  }

  return account;
}

// Synchronize the tutor's Stripe account status with Supabase.
async function synchronizeTutorStripeAccount(
  tutorId,
  db = pool
) {
  const id = validateTutorId(tutorId);

  await getTutor(id, db);

  const storedAccount = await getTutorStripeAccount(
    id,
    db
  );

  if (!storedAccount) {
    return null;
  }

  const stripeAccount = await retrieveStripeAccount(
    storedAccount.stripe_account_id
  );

  // Verify that Stripe metadata matches the stored tutor.
  if (
    stripeAccount.metadata?.tulinkup_tutor_id !== id ||
    stripeAccount.metadata?.environment !== "sandbox"
  ) {
    throw new Error(
      "Stripe account ownership could not be verified."
    );
  }

  const status = formatStripeAccountStatus(
    stripeAccount
  );

  const result = await db.query(
    `
    UPDATE public.tutor_stripe_accounts
    SET
      details_submitted = $1,
      charges_enabled = $2,
      payouts_enabled = $3,
      transfers_enabled = $4,
      onboarding_completed = $5,
      updated_at = NOW()
    WHERE tutor_id = $6
      AND stripe_account_id = $7
      AND livemode = $8
    RETURNING *
    `,
    [
      status.detailsSubmitted,
      status.chargesEnabled,
      status.payoutsEnabled,
      status.transfersEnabled,
      status.onboardingCompleted,
      id,
      status.stripeAccountId,
      LIVEMODE,
    ]
  );

  if (!result.rows.length) {
    throw new Error(
      "Unable to synchronize Stripe account."
    );
  }

  return {
    account: result.rows[0],
    status,
  };
}

// Create or retrieve a tutor's Stripe Express connected account.
async function createTutorStripeAccount(tutorId) {
  const id = validateTutorId(tutorId);

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Lock the tutor account to prevent simultaneous account creation.
    const tutorResult = await client.query(
      `
      SELECT
        id,
        full_name,
        email,
        role
      FROM public.users
      WHERE id = $1
        AND role = 'tutor'
      FOR UPDATE
      `,
      [id]
    );

    if (!tutorResult.rows.length) {
      throw new Error("Tutor account not found.");
    }

    const tutor = tutorResult.rows[0];

    // Reuse the existing connected account if one has been created.
    const existingAccount =
      await getTutorStripeAccount(
        id,
        client
      );

    if (existingAccount) {
      await client.query("COMMIT");

      return existingAccount;
    }

    // Create a Stripe connected account using Accounts v2.
    const createdAccount = await stripe.v2.core.accounts.create(
      {
        contact_email: tutor.email,
        display_name: tutor.full_name,
        dashboard: "express",

        identity: {
          country: ACCOUNT_COUNTRY.toLowerCase(),
        },

        defaults: {
          currency: "cad",

          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },

        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: {
                  requested: true,
                },
              },
            },
          },
        },

        metadata: {
          tulinkup_tutor_id: id,
          platform: "TuLinkUp",
          environment: "sandbox",
        },
      },
      {
        // Prevent duplicate accounts during retries.
        idempotencyKey: `tulinkup-sandbox-v2-tutor-${id}-account`,
      }
    );

    // Verify that the new connected account belongs to the sandbox.
    if (createdAccount.livemode !== false) {
      throw new Error("Expected a Stripe sandbox account.");
    }

    // Retrieve the account using the compatible v1 response structure.
    const stripeAccount = await retrieveStripeAccount(
      createdAccount.id
    );

    // Prepare the connected account status.
    const status = formatStripeAccountStatus(
      stripeAccount
    );

    // Store the connected account in Supabase.
    const result = await client.query(
      `
      INSERT INTO public.tutor_stripe_accounts (
        tutor_id,
        stripe_account_id,
        details_submitted,
        charges_enabled,
        payouts_enabled,
        transfers_enabled,
        onboarding_completed,
        livemode
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        id,
        status.stripeAccountId,
        status.detailsSubmitted,
        status.chargesEnabled,
        status.payoutsEnabled,
        status.transfersEnabled,
        status.onboardingCompleted,
        LIVEMODE,
      ]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    // Undo database changes when account creation fails.
    if (client) {
      await client
        .query("ROLLBACK")
        .catch((rollbackError) => {
          console.error(
            "Stripe account rollback error:",
            rollbackError.message
          );
        });
    }

    throw error;
  } finally {
    // Release the database connection.
    if (client) {
      client.release();
    }
  }
}

// Generate a Stripe-hosted onboarding link for the tutor.
async function createTutorOnboardingLink(tutorId) {
  const id = validateTutorId(tutorId);

  const frontendUrl = getFrontendUrl();

  // Create or retrieve the tutor's connected account.
  await createTutorStripeAccount(id);

  // Verify account ownership and retrieve its latest status.
  const synchronized =
    await synchronizeTutorStripeAccount(id);

  if (!synchronized) {
    throw new Error(
      "Tutor Stripe account is unavailable."
    );
  }

  const account = synchronized.account;

  // Generate a temporary Stripe onboarding link.
  const accountLink = await stripe.accountLinks.create({
    account: account.stripe_account_id,

    refresh_url:
      `${frontendUrl}/dashboard/tutor/payments/refresh`,

    return_url:
      `${frontendUrl}/dashboard/tutor/payments/return`,

    type: "account_onboarding",
  });

  return {
    url: accountLink.url,
    expiresAt: accountLink.expires_at,
    stripeAccountId: account.stripe_account_id,
  };
}

// Retrieve the tutor's current Stripe account status.
async function getTutorStripeAccountStatus(tutorId) {
  const id = validateTutorId(tutorId);

  await getTutor(id);

  const synchronized =
    await synchronizeTutorStripeAccount(id);

  // Read the current platform payment settings.
  const settings = await getPlatformSettings();

  // Return the default status for tutors without connected accounts.
  if (!synchronized) {
    return {
      hasAccount: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      transfersEnabled: false,
      onboardingCompleted: false,
      currentlyDue: [],
      pastDue: [],
      pendingVerification: [],
      disabledReason: null,
      platformPaidTutoringEnabled:
        settings.paidTutoringEnabled,
      platformTransfersEnabled:
        settings.tutorTransfersEnabled,
      eligibleForTransfers: false,
      eligibleForPayouts: false,
      livemode: LIVEMODE,
    };
  }

  const { status } = synchronized;

  return {
    hasAccount: true,

    ...status,

    platformPaidTutoringEnabled:
      settings.paidTutoringEnabled,

    platformTransfersEnabled:
      settings.tutorTransfersEnabled,

    // Both Stripe and TuLinkUp must allow new tutor transfers.
    eligibleForTransfers:
      status.onboardingCompleted &&
      status.transfersEnabled &&
      settings.tutorTransfersEnabled,

    // Stripe controls payout availability for connected account funds.
    eligibleForPayouts:
      status.onboardingCompleted &&
      status.payoutsEnabled,

    livemode: LIVEMODE,
  };
}

// Export the Stripe Connect service functions.
module.exports = {
  getTutorStripeAccount,
  formatStripeAccountStatus,
  retrieveStripeAccount,
  synchronizeTutorStripeAccount,
  createTutorStripeAccount,
  createTutorOnboardingLink,
  getTutorStripeAccountStatus,
};