"use strict";

// Validate webhook payment finances without database writes.
// All amounts are integer Canadian cents.

const {
  validatePaymentAmount,
} = require("../utils/paymentPricing");

const {
  calculateRevenueSplit,
} = require("../utils/pricing");

function verifyWebhookFinancialSnapshot(
  payment,
  session,
  source
) {
  if (
    !payment ||
    !session ||
    !source ||
    typeof payment !== "object" ||
    typeof session !== "object" ||
    typeof source !== "object"
  ) {
    throw new Error(
      "Webhook financial records are required."
    );
  }

  if (
    payment.livemode !== false ||
    session.livemode !== false
  ) {
    throw new Error(
      "Only sandbox webhook payments are supported."
    );
  }

  if (
    payment.currency !== "CAD" ||
    session.currency !== "cad"
  ) {
    throw new Error(
      "Webhook payment currency mismatch."
    );
  }

  validatePaymentAmount(
    payment.amount_cents,
    payment.payment_type
  );

  if (
    session.amount_total !== payment.amount_cents
  ) {
    throw new Error(
      "Webhook Checkout amount mismatch."
    );
  }

  const revenue = calculateRevenueSplit(
    payment.amount_cents
  );

  if (
    payment.platform_commission_cents !==
      revenue.platformCommissionCents ||
    payment.tutor_earnings_cents !==
      revenue.tutorEarningsCents
  ) {
    throw new Error(
      "Webhook payment revenue split mismatch."
    );
  }

  const sourceAmount =
    payment.payment_type === "one_on_one"
      ? source.total_price_cents
      : source.price_cents;

  if (sourceAmount !== payment.amount_cents) {
    throw new Error(
      "Webhook source amount mismatch."
    );
  }

  if (source.currency !== payment.currency) {
    throw new Error(
      "Webhook source currency mismatch."
    );
  }

  if (
    source.platform_commission_cents !==
      payment.platform_commission_cents ||
    source.tutor_earnings_cents !==
      payment.tutor_earnings_cents
  ) {
    throw new Error(
      "Webhook source revenue split mismatch."
    );
  }

  return {
    verified: true,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    platformCommissionCents:
      payment.platform_commission_cents,
    tutorEarningsCents:
      payment.tutor_earnings_cents,
  };
}

module.exports = {
  verifyWebhookFinancialSnapshot,
};
