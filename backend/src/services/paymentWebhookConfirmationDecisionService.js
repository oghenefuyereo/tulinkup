"use strict";

const {
  decideWebhookReconciliation
} = require("./paymentWebhookDecisionService");

const {
  validateWebhookConfirmationEligibility
} = require("./paymentWebhookConfirmationEligibilityService");

// Decide whether a verified webhook may update its payment source.
// This service does not execute SQL or change payment records.
function decideWebhookConfirmation({
  payment,
  eventType,
  session,
  source,
  groupClass
}) {
  if (!payment || typeof payment !== "object") {
    throw new Error("Payment record is required.");
  }

  const decision = decideWebhookReconciliation(
    payment.payment_status,
    eventType,
    session
  );

  if (
    decision.action !== "apply" ||
    decision.targetStatus !== "paid"
  ) {
    return decision;
  }

  const eligibility = validateWebhookConfirmationEligibility({
    paymentType: payment.payment_type,
    source,
    groupClass
  });

  if (!eligibility.eligible) {
    return {
      action: "manual_review",
      reason: eligibility.reason,
      targetStatus: decision.targetStatus,
      updatePayment: false,
      updateSource: false
    };
  }

  return {
    ...decision,
    requiresCapacityCheck:
      payment.payment_type === "group"
  };
}

module.exports = {
  decideWebhookConfirmation
};
