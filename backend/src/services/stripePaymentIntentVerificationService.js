"use strict";

// Verify successful Stripe Payment Intents.
// This module does not execute SQL or initiate payments.

const {
  validatePaymentRecord,
  getCheckoutMetadata,
  verifyCheckoutSession,
} = require("./stripeCheckoutService");

function verifySuccessfulPaymentIntent({
  payment,
  session,
  paymentIntent,
}) {
  const record = validatePaymentRecord(payment);

  if (!payment.stripe_checkout_session_id) {
    throw new Error("Stored Checkout session is required.");
  }

  verifyCheckoutSession(session, payment);

  if (
    session.status !== "complete" ||
    session.payment_status !== "paid"
  ) {
    throw new Error("Checkout payment is not complete.");
  }

  if (
    !paymentIntent ||
    paymentIntent.object !== "payment_intent"
  ) {
    throw new Error("Invalid Stripe Payment Intent.");
  }

  if (
    typeof paymentIntent.id !== "string" ||
    !/^pi_[a-zA-Z0-9_]+$/.test(paymentIntent.id)
  ) {
    throw new Error("Invalid Payment Intent ID.");
  }

  const sessionIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (sessionIntentId !== paymentIntent.id) {
    throw new Error("Checkout Payment Intent mismatch.");
  }

  if (
    payment.stripe_payment_intent_id &&
    payment.stripe_payment_intent_id !== paymentIntent.id
  ) {
    throw new Error("Stored Payment Intent mismatch.");
  }

  if (paymentIntent.livemode !== false) {
    throw new Error("Unexpected Payment Intent environment.");
  }

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment Intent has not succeeded.");
  }

  if (paymentIntent.currency !== "cad") {
    throw new Error("Invalid Payment Intent currency.");
  }

  if (
    paymentIntent.amount !== record.amountCents ||
    paymentIntent.amount_received !== record.amountCents
  ) {
    throw new Error("Payment Intent amount mismatch.");
  }

  const expectedMetadata = getCheckoutMetadata(payment);

  for (const [key, value] of Object.entries(expectedMetadata)) {
    if (paymentIntent.metadata?.[key] !== value) {
      throw new Error("Invalid Payment Intent metadata: " + key);
    }
  }

  const expectedTransferGroup =
    "tulinkup_payment_" + record.paymentId;

  if (
    paymentIntent.transfer_group !== expectedTransferGroup
  ) {
    throw new Error("Invalid Payment Intent transfer group.");
  }

  const chargeId =
    typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id;

  if (
    typeof chargeId !== "string" ||
    !/^ch_[a-zA-Z0-9_]+$/.test(chargeId)
  ) {
    throw new Error("Valid Stripe charge is required.");
  }

  if (
    payment.stripe_charge_id &&
    payment.stripe_charge_id !== chargeId
  ) {
    throw new Error("Stored Stripe charge mismatch.");
  }

  return {
    paymentId: record.paymentId,
    checkoutSessionId: session.id,
    paymentIntentId: paymentIntent.id,
    chargeId,
    amountCents: record.amountCents,
    currency: record.currency,
    livemode: false,
  };
}

module.exports = {
  verifySuccessfulPaymentIntent,
};
