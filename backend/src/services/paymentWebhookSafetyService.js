"use strict";

// Pure safety checks for Stripe webhook reconciliation.
// No database connections or Stripe API requests.

const MAX_ID = 9223372036854775807n;

function normalizeId(value, name) {
  const id = String(value ?? "");

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > MAX_ID
  ) {
    throw new Error("Invalid " + name + ".");
  }

  return id;
}

function verifyPersistedCheckoutSession(payment, session) {
  if (!payment || !session) {
    throw new Error("Payment and Checkout session required.");
  }

  if (payment.livemode !== false || session.livemode !== false) {
    throw new Error("Live payments are not supported.");
  }

  normalizeId(payment.id, "payment ID");

  if (
    typeof payment.stripe_checkout_session_id !== "string" ||
    !/^cs_test_[a-zA-Z0-9_]+$/.test(
      payment.stripe_checkout_session_id
    )
  ) {
    throw new Error("Persisted Checkout session is missing.");
  }

  if (
    session.id !== payment.stripe_checkout_session_id
  ) {
    throw new Error("Checkout session mismatch.");
  }

  if (
    String(session.metadata?.payment_id ?? "") !==
    String(payment.id)
  ) {
    throw new Error("Checkout payment reference mismatch.");
  }

  if (
    session.client_reference_id !== String(payment.id)
  ) {
    throw new Error("Checkout client reference mismatch.");
  }

  return true;
}

function verifyWebhookSourceState(
  paymentType,
  source,
  targetStatus
) {
  if (!source || typeof source !== "object") {
    throw new Error("Payment source is missing.");
  }

  if (
    !["one_on_one", "group"].includes(paymentType)
  ) {
    throw new Error("Unsupported payment type.");
  }

  if (
    !["processing", "paid", "failed", "expired"].includes(
      targetStatus
    )
  ) {
    throw new Error("Unsupported target status.");
  }

  if (paymentType === "one_on_one") {
    if (source.status !== "pending") {
      throw new Error("Booking is not pending.");
    }

    if (source.payment_status !== "pending") {
      throw new Error(
        "Booking payment state requires reconciliation."
      );
    }

    return true;
  }

  if (source.enrollment_status !== "pending") {
    throw new Error("Enrollment is not pending.");
  }

  if (source.payment_status !== "pending") {
    throw new Error(
      "Enrollment payment state requires reconciliation."
    );
  }

  return true;
}

module.exports = {
  verifyPersistedCheckoutSession,
  verifyWebhookSourceState,
};
