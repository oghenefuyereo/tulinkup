"use strict";

// TuLinkUp Stripe webhook payment status rules.
// Pure functions: no database or Stripe API calls.

const PROTECTED_STATUSES = new Set([
  "paid",
  "partially_refunded",
  "refunded",
  "disputed",
]);

function determineWebhookPaymentStatus(eventType, session) {
  if (!session || typeof session !== "object") {
    throw new Error("Checkout session is required.");
  }

  switch (eventType) {
    case "checkout.session.completed":
      return session.payment_status === "paid"
        ? "paid"
        : "processing";

    case "checkout.session.async_payment_succeeded":
      if (session.payment_status !== "paid") {
        throw new Error("Payment success is not confirmed.");
      }
      return "paid";

    case "checkout.session.async_payment_failed":
      return "failed";

    case "checkout.session.expired":
      if (session.status !== "expired") {
        throw new Error("Checkout expiration is not confirmed.");
      }
      return "expired";

    default:
      throw new Error("Unsupported Stripe payment event.");
  }
}

function determinePaymentTransition(currentStatus, targetStatus) {
  if (typeof currentStatus !== "string") {
    throw new Error("Current payment status is required.");
  }

  if (PROTECTED_STATUSES.has(currentStatus)) {
    return currentStatus === targetStatus
      ? "duplicate"
      : "protected";
  }

  if (currentStatus === targetStatus) {
    return "duplicate";
  }

  if (
    targetStatus === "paid" &&
    ["pending", "processing", "failed", "expired"].includes(currentStatus)
  ) {
    return "apply";
  }

  if (
    currentStatus === "pending" &&
    ["processing", "failed", "expired"].includes(targetStatus)
  ) {
    return "apply";
  }

  if (
    currentStatus === "processing" &&
    ["failed", "expired"].includes(targetStatus)
  ) {
    return "apply";
  }

  return "protected";
}

module.exports = {
  determineWebhookPaymentStatus,
  determinePaymentTransition,
};
