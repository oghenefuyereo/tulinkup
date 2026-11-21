
const stripe = require("../config/stripe");

const {
  PRICING,
  getPricingConfig,
  calculateRevenueSplit,
  validatePaymentAvailability,
} = require("../utils/pricing");

const {
  validatePaymentAmount,
} = require("../utils/paymentPricing");

const LIVEMODE = false;
const CURRENCY = "CAD";


// Validate a positive PostgreSQL database ID.
function validateId(value, name) {
  // Only accept strings or safe positive integers.
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new Error(`Invalid ${name}.`);
  }

  if (
    typeof value === "number" &&
    (!Number.isSafeInteger(value) || value <= 0)
  ) {
    throw new Error(`Invalid ${name}.`);
  }

  const id = String(value);

  // Enforce PostgreSQL BIGINT boundaries.
  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new Error(`Invalid ${name}.`);
  }

  return id;
}

// Validate a Stripe Checkout session ID.
function validateCheckoutSessionId(value) {
  if (
    typeof value !== "string" ||
    !/^cs_test_[a-zA-Z0-9_]+$/.test(value)
  ) {
    throw new Error(
      "Invalid Stripe sandbox Checkout session ID."
    );
  }

  return value;
}

// Retrieve the configured frontend URL.
function getFrontendUrl() {
  const url = new URL(
    process.env.FRONTEND_URL?.trim() ||
      "http://localhost:3000"
  );

  const isLocalhost =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(
      url.hostname
    );

  if (
    (url.protocol !== "https:" && !isLocalhost) ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid frontend URL.");
  }

  return url.origin;
}



// Validate a payment record retrieved from the database.
function validatePaymentRecord(payment) {
  if (!payment || typeof payment !== "object") {
    throw new Error("Payment record is required.");
  }

  const paymentId = validateId(
    payment.id,
    "payment ID"
  );

  const studentId = validateId(
    payment.student_id,
    "student ID"
  );

  const tutorId = validateId(
    payment.tutor_id,
    "tutor ID"
  );

  if (studentId === tutorId) {
    throw new Error(
      "Students cannot pay themselves for tutoring."
    );
  }

  if (payment.currency !== CURRENCY) {
    throw new Error("Unsupported payment currency.");
  }

  if (payment.livemode !== LIVEMODE) {
    throw new Error(
      "Only sandbox payment records are supported."
    );
  }

  validatePaymentAmount(
    payment.amount_cents,
    payment.payment_type
  );

  // Verify the stored revenue distribution.
  const revenue = calculateRevenueSplit(
    payment.amount_cents
  );

  if (
    payment.platform_commission_cents !==
      revenue.platformCommissionCents ||
    payment.tutor_earnings_cents !==
      revenue.tutorEarningsCents
  ) {
    throw new Error(
      "Invalid payment revenue distribution."
    );
  }

  let bookingId = null;
  let enrollmentId = null;

  // Validate the payment's tutoring reference.
  if (payment.payment_type === "one_on_one") {
    bookingId = validateId(
      payment.booking_id,
      "booking ID"
    );

    if (payment.enrollment_id != null) {
      throw new Error("Invalid booking payment reference.");
    }
  } else {
    enrollmentId = validateId(
      payment.enrollment_id,
      "enrollment ID"
    );

    if (payment.booking_id != null) {
      throw new Error(
        "Invalid group payment reference."
      );
    }
  }

  return {
    paymentId,
    studentId,
    tutorId,
    bookingId,
    enrollmentId,
    paymentType: payment.payment_type,
    amountCents: payment.amount_cents,
    platformCommissionCents:
      revenue.platformCommissionCents,
    tutorEarningsCents:
      revenue.tutorEarningsCents,
    currency: CURRENCY,
  };
}

// Associate a Stripe payment with TuLinkUp records.
function getCheckoutMetadata(payment) {
  const record = validatePaymentRecord(payment);

  const metadata = {
    platform: "TuLinkUp",
    environment: "sandbox",
    payment_id: record.paymentId,
    payment_type: record.paymentType,
    student_id: record.studentId,
    tutor_id: record.tutorId,
  };

  if (record.bookingId) {
    metadata.booking_id = record.bookingId;
  }

  if (record.enrollmentId) {
    metadata.enrollment_id = record.enrollmentId;
  }

  return metadata;
}

// Verify that a Stripe session matches its database payment.
function verifyCheckoutSession(session, payment) {
  const record = validatePaymentRecord(payment);

  if (!session || session.object !== "checkout.session") {
    throw new Error("Invalid Stripe Checkout session.");
  }

  validateCheckoutSessionId(session.id);

  if (session.livemode !== LIVEMODE) {
    throw new Error("Unexpected Stripe environment.");
  }

  if (session.mode !== "payment") {
    throw new Error("Invalid Checkout payment mode.");
  }

  if (
    session.currency !== CURRENCY.toLowerCase() ||
    session.amount_total !== record.amountCents
  ) {
    throw new Error(
      "Stripe Checkout payment amount does not match."
    );
  }

  if (
    session.client_reference_id !== record.paymentId
  ) {
    throw new Error(
      "Invalid Checkout payment reference."
    );
  }

  const expectedMetadata =
    getCheckoutMetadata(payment);

  for (const [key, value] of Object.entries(
    expectedMetadata
  )) {
    if (session.metadata?.[key] !== value) {
      throw new Error(
        `Invalid Checkout metadata: ${key}.`
      );
    }
  }

  if (
    payment.stripe_checkout_session_id &&
    session.id !== payment.stripe_checkout_session_id
  ) {
    throw new Error(
      "Checkout session does not match the payment."
    );
  }

  return true;
}

// Validate the secure Stripe-hosted Checkout URL.
function validateCheckoutUrl(value) {
  if (typeof value !== "string") {
    throw new Error("Checkout URL is unavailable.");
  }

  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.stripe.com" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Invalid Stripe Checkout URL.");
  }

  return value;
}

// Create a Checkout session using a trusted database payment.
async function createCheckoutSession(payment) {
  const record = validatePaymentRecord(payment);

  const pricing = await getPricingConfig();

  // Prevent paid Checkout while the platform has disabled it.
  validatePaymentAvailability(
    record.amountCents,
    pricing
  );

  if (payment.payment_status !== "pending") {
    throw new Error(
      "Only pending payments can start Checkout."
    );
  }

  // Return the existing session rather than creating another.
  if (payment.stripe_checkout_session_id) {
    const existingSession =
      await retrieveCheckoutSession(
        payment.stripe_checkout_session_id,
        payment
      );

    if (
      existingSession.status !== "open" ||
      existingSession.payment_status !== "unpaid" ||
      existingSession.expires_at <=
        Math.floor(Date.now() / 1000)
    ) {
      throw new Error(
        "The existing Checkout session is no longer available."
      );
    }

    validateCheckoutUrl(existingSession.url);

    return existingSession;
  }

  // Use an idempotency key stored with the payment record.
  const idempotencyKey = payment.idempotency_key;

  if (
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim() ||
    idempotencyKey.length > 255
  ) {
    throw new Error("Invalid payment idempotency key.");
  }

  const frontendUrl = getFrontendUrl();

  const metadata = getCheckoutMetadata(payment);

  const productName =
    record.paymentType === "one_on_one"
      ? "TuLinkUp Private Tutoring Session"
      : "TuLinkUp Group Tutoring Class";

  // Create a secure, hosted payment page.
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",

      payment_method_types: ["card"],

      client_reference_id: record.paymentId,

      line_items: [
        {
          price_data: {
            currency: CURRENCY.toLowerCase(),

            product_data: {
              name: productName,
            },

            unit_amount: record.amountCents,
          },

          quantity: 1,
        },
      ],

      metadata,

      payment_intent_data: {
        metadata,

        transfer_group:
          `tulinkup_payment_${record.paymentId}`,
      },

      success_url:
        `${frontendUrl}/payments/success` +
        "?session_id={CHECKOUT_SESSION_ID}",

      cancel_url:
        `${frontendUrl}/payments/cancel` +
        `?payment_id=${record.paymentId}`,
    },
    {
      idempotencyKey,
    }
  );

  // Verify the Stripe response before returning it.
  verifyCheckoutSession(session, payment);

  if (
    session.status !== "open" ||
    session.payment_status !== "unpaid" ||
    !Number.isSafeInteger(session.expires_at) ||
    session.expires_at <=
      Math.floor(Date.now() / 1000)
  ) {
    throw new Error(
      "Stripe returned an unavailable Checkout session."
    );
  }

  validateCheckoutUrl(session.url);

  return session;
}

// Retrieve and verify an existing Stripe Checkout session.
async function retrieveCheckoutSession(
  sessionId,
  payment
) {
  const id = validateCheckoutSessionId(sessionId);

  const session =
    await stripe.checkout.sessions.retrieve(id);

  verifyCheckoutSession(session, payment);

  return session;
}

// Expire an abandoned and unpaid Checkout session.
async function expireCheckoutSession(
  sessionId,
  payment
) {
  const session = await retrieveCheckoutSession(
    sessionId,
    payment
  );

  if (session.status === "expired") {
    return session;
  }

  if (
    session.status !== "open" ||
    session.payment_status !== "unpaid"
  ) {
    throw new Error(
      "Only open and unpaid Checkout sessions can expire."
    );
  }

  const expiredSession =
    await stripe.checkout.sessions.expire(session.id);

  verifyCheckoutSession(
    expiredSession,
    payment
  );

  if (expiredSession.status !== "expired") {
    throw new Error(
      "Unable to verify Checkout expiration."
    );
  }

  return expiredSession;
}

// Export the Stripe Checkout service functions.
module.exports = {
  validatePaymentAmount,
  validatePaymentRecord,
  getCheckoutMetadata,
  verifyCheckoutSession,
  createCheckoutSession,
  retrieveCheckoutSession,
  expireCheckoutSession,
};
