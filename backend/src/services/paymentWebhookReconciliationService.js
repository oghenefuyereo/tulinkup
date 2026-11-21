"use strict";

// TuLinkUp Stripe webhook reconciliation.
// Phase 1: Validate signed Stripe Checkout event data.
// Database reconciliation will be added after testing.

const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

function validateWebhookCheckoutEvent(event) {
  if (!event || !SUPPORTED_EVENTS.has(event.type)) {
    throw new Error("Unsupported payment event.");
  }

  if (event.livemode !== false) {
    throw new Error("Only Stripe sandbox events are supported.");
  }

  const session = event.data?.object;

  if (!session || session.object !== "checkout.session") {
    throw new Error("Invalid Checkout session object.");
  }

  if (
    typeof session.id !== "string" ||
    !/^cs_test_[a-zA-Z0-9_]+$/.test(session.id)
  ) {
    throw new Error("Invalid sandbox Checkout session ID.");
  }

  if (session.livemode !== false || session.mode !== "payment") {
    throw new Error("Invalid Checkout environment or mode.");
  }

  const paymentId = session.metadata?.payment_id;

  if (
    typeof paymentId !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(paymentId) ||
    BigInt(paymentId) > 9223372036854775807n ||
    session.client_reference_id !== paymentId
  ) {
    throw new Error("Invalid Checkout payment reference.");
  }

  if (
    session.currency !== "cad" ||
    !Number.isSafeInteger(session.amount_total) ||
    session.amount_total <= 0
  ) {
    throw new Error("Invalid Checkout amount or currency.");
  }

  const successfulEvent =
    event.type === "checkout.session.async_payment_succeeded" ||
    (event.type === "checkout.session.completed" &&
      session.payment_status === "paid");

  if (successfulEvent && session.payment_status !== "paid") {
    throw new Error("Checkout payment is not paid.");
  }

  if (
    event.type === "checkout.session.async_payment_failed" &&
    session.payment_status === "paid"
  ) {
    throw new Error("Failed event cannot contain a paid session.");
  }

  if (
    event.type === "checkout.session.expired" &&
    session.status !== "expired"
  ) {
    throw new Error("Checkout session is not expired.");
  }

  return {
    eventId: event.id,
    eventType: event.type,
    paymentId,
    session,
    successfulEvent,
  };
}

module.exports = {
  validateWebhookCheckoutEvent,
};
