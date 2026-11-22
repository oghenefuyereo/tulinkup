"use strict";

// Pure webhook reconciliation decision logic.
// Does not execute SQL or contact Stripe.

const {
  determineWebhookPaymentStatus,
  determinePaymentTransition,
} = require("./paymentWebhookStatusService");

function decideWebhookReconciliation(
  currentPaymentStatus,
  eventType,
  session
) {
  const targetStatus = determineWebhookPaymentStatus(
    eventType,
    session
  );

  const transition = determinePaymentTransition(
    currentPaymentStatus,
    targetStatus
  );

  if (transition === "duplicate") {
    return {
      action: "duplicate",
      targetStatus,
      updatePayment: false,
      updateSource: false,
    };
  }

  if (transition === "protected") {
    return {
      action: "protected",
      targetStatus,
      updatePayment: false,
      updateSource: false,
    };
  }

  if (transition !== "apply") {
    throw new Error("Unexpected payment transition.");
  }

  // A late successful event following a failed or expired
  // payment needs additional source and capacity checks.
  if (
    targetStatus === "paid" &&
    ["failed", "expired"].includes(currentPaymentStatus)
  ) {
    return {
      action: "recovery_required",
      targetStatus,
      updatePayment: false,
      updateSource: false,
    };
  }

  return {
    action: "apply",
    targetStatus,
    updatePayment: true,
    updateSource: true,
  };
}

module.exports = {
  decideWebhookReconciliation,
};
