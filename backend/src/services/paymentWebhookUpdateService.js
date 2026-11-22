"use strict";

// Build a safe, parameterized webhook payment update.
// This module does not execute SQL or connect to PostgreSQL.

const {
  validateId,
} = require("./paymentTransactionService");

const {
  determinePaymentTransition,
} = require("./paymentWebhookStatusService");

const ALLOWED_TARGETS = new Set([
  "processing",
  "paid",
  "failed",
  "expired",
]);

function buildWebhookPaymentUpdate(
  paymentId,
  currentStatus,
  targetStatus
) {
  const id = validateId(paymentId, "Payment ID");

  if (!ALLOWED_TARGETS.has(targetStatus)) {
    throw new Error("Unsupported webhook target status.");
  }

  const transition = determinePaymentTransition(
    currentStatus,
    targetStatus
  );

  if (transition !== "apply") {
    throw new Error(
      "Payment transition cannot be applied: " + transition
    );
  }

  return {
    text: `
      UPDATE public.payments
      SET payment_status = $1,
          paid_at = CASE
            WHEN $1 = 'paid' THEN NOW()
            ELSE paid_at
          END,
          updated_at = NOW()
      WHERE id = $2
        AND payment_status = $3
        AND livemode = false
        AND stripe_checkout_session_id IS NOT NULL
      RETURNING *
    `,
    values: [
      targetStatus,
      id,
      currentStatus,
    ],
  };
}

module.exports = {
  buildWebhookPaymentUpdate,
};
