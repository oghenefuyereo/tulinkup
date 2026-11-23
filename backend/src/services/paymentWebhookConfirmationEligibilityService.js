"use strict";

// Pure eligibility checks for webhook payment confirmation.
// Database capacity checks must be performed separately while
// holding the group class lock inside the same transaction.

function validateWebhookConfirmationEligibility({
  paymentType,
  source,
  groupClass,
  now = new Date()
}) {
  if (!source || typeof source !== "object") {
    throw new Error("Payment source is required.");
  }

  if (source.payment_status !== "pending") {
    return {
      eligible: false,
      reason: "source_payment_not_pending"
    };
  }

  if (paymentType === "one_on_one") {
    return source.status === "pending"
      ? { eligible: true, reason: null }
      : { eligible: false, reason: "booking_not_pending" };
  }

  if (paymentType === "group") {
    if (source.enrollment_status !== "pending") {
      return {
        eligible: false,
        reason: "enrollment_not_pending"
      };
    }

    if (!groupClass || groupClass.status !== "published") {
      return {
        eligible: false,
        reason: "class_not_published"
      };
    }

    const scheduledAt = new Date(groupClass.scheduled_at);
    const currentTime = new Date(now);

    if (
      !Number.isFinite(scheduledAt.getTime()) ||
      !Number.isFinite(currentTime.getTime()) ||
      scheduledAt <= currentTime
    ) {
      return {
        eligible: false,
        reason: "class_not_future"
      };
    }

    return { eligible: true, reason: null };
  }

  throw new Error("Unsupported payment type.");
}

module.exports = {
  validateWebhookConfirmationEligibility
};
