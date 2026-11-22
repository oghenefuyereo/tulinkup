"use strict";

// Pure SQL builder for recording a paid group enrollment.
// Does not connect to PostgreSQL or Stripe.

const MAX_ID = 9223372036854775807n;

function normalizeId(value) {
  const id = String(value ?? "");

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > MAX_ID
  ) {
    throw new Error("Invalid enrollment ID.");
  }

  return id;
}

function validateAmount(value) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > 1000
  ) {
    throw new Error("Invalid group payment amount.");
  }

  return value;
}

function buildWebhookGroupAmountUpdate(
  enrollmentId,
  amountCents
) {
  const id = normalizeId(enrollmentId);
  const amount = validateAmount(amountCents);

  return {
    text: `
      UPDATE public.group_class_enrollments
      SET amount_paid_cents = $1,
          updated_at = NOW()
      WHERE id = $2
        AND enrollment_status = 'confirmed'
        AND payment_status = 'paid'
        AND amount_paid_cents = 0
        AND price_cents = $1
      RETURNING id, amount_paid_cents
    `,
    values: [amount, id],
  };
}

module.exports = {
  buildWebhookGroupAmountUpdate,
};
