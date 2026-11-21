"use strict";

// Map payment statuses to database-compatible source statuses.
// Pure functions: no database or Stripe connections.

function getSourcePaymentStatus(paymentStatus) {
  switch (paymentStatus) {
    case "pending":
    case "processing":
      return "pending";

    case "paid":
      return "paid";

    case "failed":
      return "failed";

    case "expired":
    case "cancelled":
      return "unpaid";

    case "partially_refunded":
      return "paid";

    case "refunded":
      return "refunded";

    case "disputed":
      return "paid";

    default:
      throw new Error(
        "Unsupported payment status: " + paymentStatus
      );
  }
}

function getSourceConfirmation(paymentType, paymentStatus) {
  if (!["one_on_one", "group"].includes(paymentType)) {
    throw new Error("Unsupported payment type.");
  }

  const sourcePaymentStatus =
    getSourcePaymentStatus(paymentStatus);

  return {
    paymentStatus: sourcePaymentStatus,
    enrollmentStatus:
      paymentType === "group" && paymentStatus === "paid"
        ? "confirmed"
        : null,
  };
}

module.exports = {
  getSourcePaymentStatus,
  getSourceConfirmation,
};
