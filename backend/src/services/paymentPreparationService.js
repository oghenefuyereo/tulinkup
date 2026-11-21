
const {
  LIVEMODE,
  validateId,
  validatePaymentType,
  generateIdempotencyKey,
  withPaymentTransaction,
  lockPaymentSource,
  inspectPaymentHistory,
  requireLockedPaymentSource,
  validateStoredIdempotencyKey,
} = require("./paymentTransactionService");

const {
  validateBookingPayment,
  validateGroupPayment,
  validatePaymentSource,
} = require("./paymentValidationService");

const {
  getPricingConfig,
  validatePaymentAvailability,
  calculatePrivateSessionPrice,
  calculateRevenueSplit,
  validateGroupPricing,
} = require("../utils/pricing");

// Create a payment error with an appropriate HTTP status.
function paymentError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Lock the platform settings so they cannot change
// while a payment is being prepared.
async function getLockedPricingConfig(client) {
  const result = await client.query(
    `SELECT id
     FROM public.platform_settings
     WHERE id = $1
     FOR SHARE`,
    [1]
  );

  if (result.rows.length !== 1) {
    throw paymentError(
      "Platform payment settings are unavailable.",
      500
    );
  }

  const pricing = await getPricingConfig(client);

  // Paid tutoring must remain unavailable until enabled.
  if (pricing.PAID_TUTORING_ENABLED !== true) {
    throw paymentError(
      "Paid tutoring is currently unavailable.",
      503
    );
  }

  return pricing;
}

// Confirm that the payment still follows
// the current platform pricing configuration.
function validateCurrentPricing(
  snapshot,
  lockedSource,
  pricing
) {
  validatePaymentAvailability(
    snapshot.amount_cents,
    pricing
  );

  if (snapshot.currency !== pricing.CURRENCY) {
    throw paymentError(
      "Payment currency does not match platform settings."
    );
  }

  if (snapshot.payment_type === "one_on_one") {
    const booking = lockedSource.booking;

    const expectedAmount =
      calculatePrivateSessionPrice(
        booking.hourly_rate_cents,
        booking.duration_minutes,
        pricing
      );

    if (expectedAmount !== snapshot.amount_cents) {
      throw paymentError(
        "Private session pricing has changed."
      );
    }
  } else {
    const groupClass = lockedSource.groupClass;

    validateGroupPricing(
      groupClass.price_cents,
      groupClass.minimum_students,
      groupClass.maximum_students,
      pricing
    );

    if (
      groupClass.price_cents !== snapshot.amount_cents
    ) {
      throw paymentError(
        "Group class pricing has changed."
      );
    }
  }

  // Recalculate the revenue split using current settings.
  const revenue = calculateRevenueSplit(
    snapshot.amount_cents,
    pricing
  );

  if (
    snapshot.platform_commission_cents !==
      revenue.platformCommissionCents ||
    snapshot.tutor_earnings_cents !==
      revenue.tutorEarningsCents
  ) {
    throw paymentError(
      "Payment revenue allocation does not match platform settings."
    );
  }
}

// Update the tutoring source after creating a payment.
//
// This must happen in the same transaction as the
// payment insertion so both changes succeed together.
async function markSourcePaymentPending(
  snapshot,
  client
) {
  const type = validatePaymentType(
    snapshot.payment_type
  );

  const sourceId = validateId(
    type === "one_on_one"
      ? snapshot.booking_id
      : snapshot.enrollment_id,
    "payment source ID"
  );

  const studentId = validateId(
    snapshot.student_id,
    "student ID"
  );

  requireLockedPaymentSource(
    type,
    sourceId,
    studentId,
    client
  );

  let result;

  if (type === "one_on_one") {
    result = await client.query(
      `UPDATE public.bookings
       SET payment_status = 'pending'
       WHERE id = $1
         AND student_id = $2
         AND status = 'pending'
         AND payment_status = 'unpaid'
       RETURNING id, payment_status`,
      [sourceId, studentId]
    );
  } else {
    result = await client.query(
      `UPDATE public.group_class_enrollments
       SET payment_status = 'pending',
           updated_at = NOW()
       WHERE id = $1
         AND student_id = $2
         AND enrollment_status = 'pending'
         AND payment_status = 'unpaid'
         AND amount_paid_cents = 0
       RETURNING id, payment_status`,
      [sourceId, studentId]
    );
  }

  // Reject the operation if the source is no longer eligible.
  if (
    result.rows.length !== 1 ||
    result.rows[0].payment_status !== "pending"
  ) {
    throw paymentError(
      "Unable to reserve the tutoring payment source."
    );
  }

  return result.rows[0];
}

// Create a pending payment using trusted server-side values.
async function insertPendingPayment(snapshot, client) {
  const type = validatePaymentType(
    snapshot.payment_type
  );

  const sourceId = validateId(
    type === "one_on_one"
      ? snapshot.booking_id
      : snapshot.enrollment_id,
    "payment source ID"
  );

  const studentId = validateId(
    snapshot.student_id,
    "student ID"
  );

  requireLockedPaymentSource(
    type,
    sourceId,
    studentId,
    client
  );

  // Generate a new key only for a new payment attempt.
  const idempotencyKey = generateIdempotencyKey(
    type,
    sourceId
  );

  const result = await client.query(
    `INSERT INTO public.payments (
       student_id,
       tutor_id,
       payment_type,
       booking_id,
       enrollment_id,
       amount_cents,
       platform_commission_cents,
       tutor_earnings_cents,
       currency,
       idempotency_key,
       payment_status,
       livemode
     )
     VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12
     )
     RETURNING *`,
    [
      snapshot.student_id,
      snapshot.tutor_id,
      type,
      snapshot.booking_id,
      snapshot.enrollment_id,
      snapshot.amount_cents,
      snapshot.platform_commission_cents,
      snapshot.tutor_earnings_cents,
      snapshot.currency,
      idempotencyKey,
      "pending",
      LIVEMODE,
    ]
  );

  if (result.rows.length !== 1) {
    throw paymentError(
      "Unable to create the payment record.",
      500
    );
  }

  const payment = result.rows[0];

  // Ensure the generated key was stored correctly.
  const storedKey =
    validateStoredIdempotencyKey(payment);

  if (storedKey !== idempotencyKey) {
    throw paymentError(
      "Stored payment key does not match.",
      500
    );
  }

  return payment;
}

// Prepare either a private or group tutoring payment.
//
// No amount, commission or tutor earnings are accepted
// from the frontend. All values come from the database.
async function preparePayment(
  paymentType,
  sourceId,
  user
) {
  const type = validatePaymentType(paymentType);

  const id = validateId(
    sourceId,
    "payment source ID"
  );

  return withPaymentTransaction(async (client) => {
    // Authorize the student and lock the tutoring source.
    const lockedSource = await lockPaymentSource(
      type,
      id,
      user,
      client
    );

    const studentId = lockedSource.studentId;

    // Check whether paid tutoring is available.
    const pricing =
      await getLockedPricingConfig(client);

    // Inspect every previous payment attempt.
    const history = await inspectPaymentHistory(
      type,
      id,
      studentId,
      client
    );

    // Never create another payment when an active
    // blocking payment already exists.
    if (history.action === "block") {
      throw paymentError(
        "An existing payment prevents another payment attempt."
      );
    }

    // Historical attempts must be reconciled with Stripe
    // before another payment is created or reused.
    if (history.action === "reconcile") {
      const error = paymentError(
        "Previous payment attempts require reconciliation."
      );

      error.code =
        "PAYMENT_RECONCILIATION_REQUIRED";

      throw error;
    }

    const source =
      type === "one_on_one"
        ? lockedSource.booking
        : lockedSource.enrollment;

    // Verify booking or enrollment eligibility and derive
    // the payment snapshot from trusted database records.
    const snapshot =
      type === "one_on_one"
        ? await validateBookingPayment(
            id,
            studentId,
            client
          )
        : await validateGroupPayment(
            id,
            studentId,
            client
          );

    validateCurrentPricing(
      snapshot,
      lockedSource,
      pricing
    );

    // Reuse the existing pending payment record.
    // Never generate a replacement idempotency key.
    if (history.action === "reuse") {
      if (source.payment_status !== "pending") {
        throw paymentError(
          "Payment source status requires reconciliation."
        );
      }

      const payment = history.payment;

      await validatePaymentSource(
        payment,
        user,
        client
      );

      validateStoredIdempotencyKey(payment);

      return {
        action: "reuse",
        payment,
        stripeVerificationRequired: true,
      };
    }

    // Reject unexpected payment history decisions.
    if (history.action !== "create") {
      throw paymentError(
        "Unsupported payment preparation action.",
        500
      );
    }

    // A new payment requires an unpaid tutoring source.
    if (source.payment_status !== "unpaid") {
      throw paymentError(
        "The tutoring source is not eligible for a new payment."
      );
    }

    // Insert the payment and persist its idempotency key.
    const payment = await insertPendingPayment(
      snapshot,
      client
    );

    // Update the booking or enrollment in the same
    // transaction. Any failure will roll back both changes.
    await markSourcePaymentPending(
      snapshot,
      client
    );

    // Verify the stored payment against its updated source
    // before allowing the transaction to commit.
    await validatePaymentSource(
      payment,
      user,
      client
    );

    return {
      action: "create",
      payment,
      stripeVerificationRequired: true,
    };
  });
}

module.exports = {
  preparePayment,
};
