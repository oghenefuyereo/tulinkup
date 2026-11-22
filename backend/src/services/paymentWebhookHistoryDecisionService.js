"use strict";

// Pure webhook payment-history decision logic.
// No database or Stripe connections.

const MAX_ID = 9223372036854775807n;

const VALID_STATUSES = new Set([
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "partially_refunded",
  "refunded",
  "disputed",
]);

function normalizeId(value) {
  if (
    typeof value !== "string" &&
    !(typeof value === "number" && Number.isSafeInteger(value))
  ) {
    throw new Error("Invalid payment ID.");
  }

  const id = String(value);

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > MAX_ID
  ) {
    throw new Error("Invalid payment ID.");
  }

  return id;
}

function decideWebhookPaymentHistory(
  paymentId,
  payments
) {
  const id = normalizeId(paymentId);

  if (!Array.isArray(payments)) {
    throw new Error("Payment history must be an array.");
  }

  if (payments.length === 0) {
    throw new Error("Webhook payment is missing from history.");
  }

  const seen = new Set();
  let current = null;

  for (const payment of payments) {
    if (!payment || typeof payment !== "object") {
      throw new Error("Invalid payment history record.");
    }

    const recordId = normalizeId(payment.id);

    if (seen.has(recordId)) {
      throw new Error("Duplicate payment history record.");
    }

    seen.add(recordId);

    if (
      payment.livemode !== false ||
      !VALID_STATUSES.has(payment.payment_status)
    ) {
      throw new Error("Invalid sandbox payment history state.");
    }

    if (recordId === id) {
      current = payment;
    }
  }

  if (!current) {
    throw new Error("Webhook payment not found in history.");
  }

  if (payments.length !== 1) {
    return {
      action: "manual_review",
      reason: "multiple_payment_attempts",
      paymentId: id,
    };
  }

  return {
    action: "continue",
    reason: "single_payment_attempt",
    paymentId: id,
  };
}

module.exports = {
  decideWebhookPaymentHistory,
};
